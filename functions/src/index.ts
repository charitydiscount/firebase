import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { processTx } from './tx';
import { TxStatus } from './tx/types';

admin.initializeApp();
const db = admin.firestore();

export const createWalletDocument = functions.auth
  .user()
  .onCreate(async (user: functions.auth.UserRecord) => {
    await db
      .collection('points')
      .doc(user.uid)
      .create({
        cashback: {
          approved: 0.0,
          pending: 0.0
        },
        points: {
          approved: 0.0,
          pending: 0.0
        }
      });
  });

export const processTransaction = functions.firestore
  .document('transactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const tx = snap.data();
    if (!tx) {
      console.log(`Undefined transaction`);
      return;
    }

    const txResult = await processTx(
      db,
      {
        id: snap.id,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        userId: tx.userId,
        createdAt: tx.createdAt,
        target: tx.target
      },
      snap.ref);

    if (txResult.status === TxStatus.ACCEPTED) {
      console.log(`Transaction ${snap.id} processed successfully.`);
    } else {
      console.log(`Transaction ${snap.id} rejected.`);
    }
  });
