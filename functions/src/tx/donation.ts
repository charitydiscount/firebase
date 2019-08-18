import * as TxDefinitions from './types';
import { DocumentReference, Timestamp, FieldValue } from '@google-cloud/firestore';

export default class DonationHandler implements TxDefinitions.TxHandler {
  private bonusPercentage: number;
  private walletRef: DocumentReference;
  private txRef: DocumentReference;

  constructor(walletRef: DocumentReference,
    bonusPercentage: number,
    txRef: DocumentReference) {
    this.bonusPercentage = bonusPercentage;
    this.walletRef = walletRef;
    this.txRef = txRef;
  }

  async process(tx: TxDefinitions.Transaction): Promise<TxDefinitions.ProcessResult> {
    const txTimestamp = Timestamp.fromDate(new Date());
    const dueAmount = FieldValue.increment(-tx.amount);
    const generatedPoints = tx.amount * this.bonusPercentage;
    const duePoints = FieldValue.increment(generatedPoints);

    const userTxDonation: TxDefinitions.UserTransaction = {
      amount: tx.amount,
      currency: tx.currency,
      date: txTimestamp,
      type: TxDefinitions.TxType.DONATION,
      sourceTxId: tx.id,
    };
    const userTxBonus: TxDefinitions.UserTransaction = {
      amount: generatedPoints,
      currency: tx.currency,
      date: txTimestamp,
      type: TxDefinitions.TxType.BONUS,
      sourceTxId: tx.id,
    };

    await this.walletRef.update({
      "cashback.approved": dueAmount,
      "points.approved": duePoints,
      "transactions": FieldValue.arrayUnion(userTxDonation, userTxBonus),
    });

    await this.txRef.update({ status: TxDefinitions.TxStatus.ACCEPTED });

    return { status: TxDefinitions.TxStatus.ACCEPTED };
  }
}
