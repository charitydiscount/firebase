import * as TxDefinitions from './types';
import { firestore } from 'firebase-admin';

export default class RejectHandler implements TxDefinitions.TxHandler {
  private txRef: firestore.DocumentReference;

  constructor(txRef: firestore.DocumentReference) {
    this.txRef = txRef;
  }

  async process(
    tx: TxDefinitions.TxRequest,
  ): Promise<TxDefinitions.ProcessResult> {
    const txTimestamp = firestore.Timestamp.fromDate(new Date());
    await this.txRef.update({
      status: TxDefinitions.TxStatus.REJECTED,
      updatedAt: txTimestamp,
    });
    return { status: TxDefinitions.TxStatus.REJECTED };
  }
}
