import * as TxDefinitions from './types';
import DonationHandler from './donation';
import CashoutHandler from './cashout';
import RejectHandler from './reject';
import { firestore } from 'firebase-admin';
import NoopHandler from './noop';

export async function processTx(
  db: firestore.Firestore,
  tx: TxDefinitions.TxRequest,
  txRef: firestore.DocumentReference,
): Promise<TxDefinitions.ProcessResult> {
  const txHandler = await getTxHandler(db, tx, txRef);

  return txHandler.process(tx);
}

async function getTxHandler(
  db: firestore.Firestore,
  tx: TxDefinitions.TxRequest,
  txRef: firestore.DocumentReference,
): Promise<TxDefinitions.TxHandler> {
  if (tx.status !== TxDefinitions.TxStatus.PENDING) {
    return new NoopHandler();
  }

  if (tx.amount <= 0) {
    console.log(`Amount too small`);
    return new RejectHandler(txRef);
  }

  const concurrentRequest = await db
    .collection('requests')
    .where(firestore.FieldPath.documentId(), '<', txRef.id)
    .where(firestore.FieldPath.documentId(), '>', txRef.id)
    .where('userId', '==', tx.userId)
    .where('status', '==', TxDefinitions.TxStatus.PENDING)
    .get();
  if (!concurrentRequest.empty) {
    console.log('Concurrent transaction requests not allowed');
    return new RejectHandler(txRef);
  }

  const walletRef = db.doc(`points/${tx.userId}`);
  const userWallet = await walletRef.get();

  if (!userWallet || !userWallet.exists) {
    console.log(`Invalid user ${tx.userId}`);
    return new RejectHandler(txRef);
  }

  const balance = userWallet.data()!.cashback.approved;

  if (tx.amount > balance) {
    console.log(`Not enough balance available`);
    return new RejectHandler(txRef);
  }

  switch (tx.type) {
    case TxDefinitions.TxType.DONATION:
      const meta = await db.doc('meta/general').get();
      const bonusPercentage = meta.data()!.bonusPercentage || 0;
      const caseRef = db.collection('cases').doc(tx.target.id);
      return new DonationHandler(walletRef, bonusPercentage, txRef, caseRef);
    case TxDefinitions.TxType.CASHOUT:
      return new CashoutHandler(walletRef, txRef);
    default:
      return new RejectHandler(txRef);
  }
}
