import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { processTx } from './tx';
import { TxStatus } from './tx/types';
import { updateProgramRating } from './rating';
import { ProgramReviews } from './rating/types';

admin.initializeApp();
const db = admin.firestore();

/**
 * Create the user wallet document when a new user registers
 */
export const createWalletDocument = functions.auth
  .user()
  .onCreate(async (user: functions.auth.UserRecord) => {
    await db
      .collection('points')
      .doc(user.uid)
      .create({
        cashback: {
          approved: 0.0,
          pending: 0.0,
        },
        points: {
          approved: 0.0,
          pending: 0.0,
        },
      });
  });

/**
 * Process the donation/cashout request
 */
export const processTransaction = functions.firestore
  .document('requests/{requestId}')
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
        target: tx.target,
      },
      snap.ref
    );

    if (txResult.status === TxStatus.ACCEPTED) {
      console.log(`Request ${snap.id} processed successfully.`);
    } else {
      console.log(`Request ${snap.id} rejected.`);
    }
  });

export const updateOverallRating = functions.firestore
  .document('reviews/{programId}')
  .onWrite(async (snap, context) => {
    await updateProgramRating(db, snap.after.data() as ProgramReviews);
  });
