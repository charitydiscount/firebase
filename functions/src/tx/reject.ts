import * as TxDefinitions from './types';
import { DocumentReference } from '@google-cloud/firestore';

export default class RejectHandler implements TxDefinitions.TxHandler {
  private txRef: DocumentReference;

  constructor(txRef: DocumentReference) {
    this.txRef = txRef;
  }

  async process(
    tx: TxDefinitions.TxRequest
  ): Promise<TxDefinitions.ProcessResult> {
    await this.txRef.update({ status: TxDefinitions.TxStatus.REJECTED });
    return { status: TxDefinitions.TxStatus.REJECTED };
  }
}
