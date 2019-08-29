import * as TxDefinitions from './types';
import {
  DocumentReference,
  Timestamp,
  FieldValue,
} from '@google-cloud/firestore';

export default class CashoutHandler implements TxDefinitions.TxHandler {
  private walletRef: DocumentReference;
  private txRef: DocumentReference;

  constructor(walletRef: DocumentReference, txRef: DocumentReference) {
    this.walletRef = walletRef;
    this.txRef = txRef;
  }

  async process(
    tx: TxDefinitions.TxRequest
  ): Promise<TxDefinitions.ProcessResult> {
    const txTimestamp = Timestamp.fromDate(new Date());
    const dueAmount = FieldValue.increment(-tx.amount);

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
      transactions: FieldValue.arrayUnion(userTxCashout),
    });

    await this.txRef.update({ status: TxDefinitions.TxStatus.ACCEPTED });

    return { status: TxDefinitions.TxStatus.ACCEPTED };
  }
}
