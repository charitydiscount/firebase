import * as TxDefinitions from './types';
import { firestore } from 'firebase-admin';
import elastic from '../elastic';

export default class CashoutHandler implements TxDefinitions.TxHandler {
  private walletRef: firestore.DocumentReference;
  private txRef: firestore.DocumentReference;

  constructor(
    walletRef: firestore.DocumentReference,
    txRef: firestore.DocumentReference,
  ) {
    this.walletRef = walletRef;
    this.txRef = txRef;
  }

  async process(
    tx: TxDefinitions.TxRequest,
  ): Promise<TxDefinitions.ProcessResult> {
    const txTimestamp = firestore.Timestamp.fromDate(new Date());
    const dueAmount = firestore.FieldValue.increment(-tx.amount);

    const userTxCashout: TxDefinitions.UserTransaction = {
      amount: tx.amount,
      currency: tx.currency,
      date: txTimestamp,
      type: TxDefinitions.TxType.CASHOUT,
      sourceTxId: tx.id,
      target: tx.target,
    };

    await this.walletRef.update({
      'cashback.approved': dueAmount,
      'transactions': firestore.FieldValue.arrayUnion(userTxCashout),
    });

    await this.txRef.update({
      status: TxDefinitions.TxStatus.ACCEPTED,
      updatedAt: txTimestamp,
    });
    await elastic.client.update({
      id: tx.id,
      index: elastic.indeces.CASHOUT_INDEX,
      body: userTxCashout,
    });

    return { status: TxDefinitions.TxStatus.ACCEPTED };
  }
}
