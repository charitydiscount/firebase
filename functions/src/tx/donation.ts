import * as TxDefinitions from './types';
import { firestore } from 'firebase-admin';
import elastic from '../elastic';

export default class DonationHandler implements TxDefinitions.TxHandler {
  private bonusPercentage: number;
  private walletRef: firestore.DocumentReference;
  private txRef: firestore.DocumentReference;
  private caseRef: firestore.DocumentReference;

  constructor(
    walletRef: firestore.DocumentReference,
    bonusPercentage: number,
    txRef: firestore.DocumentReference,
    caseRef: firestore.DocumentReference,
  ) {
    this.bonusPercentage = bonusPercentage;
    this.walletRef = walletRef;
    this.txRef = txRef;
    this.caseRef = caseRef;
  }

  async process(
    tx: TxDefinitions.TxRequest,
  ): Promise<TxDefinitions.ProcessResult> {
    const txTimestamp = firestore.Timestamp.fromDate(new Date());
    const dueAmount = firestore.FieldValue.increment(-tx.amount);
    const generatedPoints = tx.amount * this.bonusPercentage;
    const duePoints = firestore.FieldValue.increment(generatedPoints);

    const userTxDonation: TxDefinitions.UserTransaction = {
      amount: tx.amount,
      currency: tx.currency,
      date: txTimestamp,
      type: TxDefinitions.TxType.DONATION,
      sourceTxId: tx.id,
      target: tx.target,
    };
    const userTxBonus: TxDefinitions.UserTransaction = {
      amount: generatedPoints,
      currency: 'Charity Points',
      date: txTimestamp,
      type: TxDefinitions.TxType.BONUS,
      sourceTxId: tx.id,
      target: tx.target,
    };

    await this.walletRef.update({
      'cashback.approved': dueAmount,
      'points.approved': duePoints,
      'transactions': firestore.FieldValue.arrayUnion(
        userTxDonation,
        userTxBonus,
      ),
    });

    await this.txRef.update({
      status: TxDefinitions.TxStatus.ACCEPTED,
      updatedAt: txTimestamp,
    });

    await this.caseRef.update({
      funds: firestore.FieldValue.increment(tx.amount),
    });

    const bulkBody = [
      {
        index: {
          _index: elastic.indeces.DONATIONS_INDEX,
          _id: userTxDonation.sourceTxId,
        },
      },
      { ...userTxDonation, elasticDate: new Date() },
      {
        index: {
          _index: elastic.indeces.BONUS_INDEX,
          _id: userTxBonus.sourceTxId,
        },
      },
      { ...userTxBonus, elasticDate: new Date() },
    ];
    try {
      const { body: bulkResponse } = await elastic.client.bulk({
        body: bulkBody,
      });
      if (bulkResponse.errors) {
        const erroredDocuments: any[] = [];
        bulkResponse.items.forEach((action: any, i: number) => {
          const operation = Object.keys(action)[0];
          if (action[operation].error) {
            erroredDocuments.push({
              status: action[operation].status,
              error: action[operation].error,
              operation: bulkBody[i * 2],
              document: bulkBody[i * 2 + 1],
            });
          }
        });
        console.log(erroredDocuments);
      }
    } catch (e) {
      console.log(e);
    }

    return { status: TxDefinitions.TxStatus.ACCEPTED };
  }
}
