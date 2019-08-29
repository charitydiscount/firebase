import * as TxDefinitions from './types';
import DonationHandler from './donation';
import CashoutHandler from './cashout';
import RejectHandler from './reject';
import { DocumentReference, Firestore } from '@google-cloud/firestore';

export async function processTx(
  db: Firestore,
  tx: TxDefinitions.TxRequest,
  txRef: DocumentReference
): Promise<TxDefinitions.ProcessResult> {
  const txHandler = await getTxHandler(db, tx, txRef);

  return txHandler.process(tx);
}

async function getTxHandler(
  db: Firestore,
  tx: TxDefinitions.TxRequest,
  txRef: DocumentReference
): Promise<TxDefinitions.TxHandler> {
  const walletRef = db.doc(`points/${tx.userId}`);
  const userWallet = await walletRef.get();

  if (!userWallet || !userWallet.exists) {
    console.log(`Invalid user ${tx.userId}`);
    return new RejectHandler(txRef);
  }

  const balance = userWallet.data()!.cashback!.approved;

  if (tx.amount > balance) {
    console.log(`Not enough balance available`);
    return new RejectHandler(txRef);
  }

  switch (tx.type) {
    case TxDefinitions.TxType.DONATION:
      const meta = await db.doc('meta/2performant').get();
      const bonusPercentage = meta.data()!.bonusPercentage || 0;
      return new DonationHandler(walletRef, bonusPercentage, txRef);
    case TxDefinitions.TxType.CASHOUT:
      return new CashoutHandler(walletRef, txRef);
    default:
      return new RejectHandler(txRef);
  }
}
