import * as TxDefinitions from './types';

export default class NoopHandler implements TxDefinitions.TxHandler {
  async process(
    tx: TxDefinitions.TxRequest
  ): Promise<TxDefinitions.ProcessResult> {
    console.log('Transaction already processed');
    return { status: TxDefinitions.TxStatus.REJECTED };
  }
}
