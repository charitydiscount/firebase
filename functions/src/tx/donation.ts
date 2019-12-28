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

    await elastic
      .sendBulkRequest(
        elastic.buildBulkBodyForTx([userTxDonation, userTxBonus]),
      )
      .catch((e) => console.log(e));

    return { status: TxDefinitions.TxStatus.ACCEPTED };
  }
}
