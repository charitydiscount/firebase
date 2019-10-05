import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

import { processTx } from './tx';
import { TxStatus } from './tx/types';
import { updateProgramRating } from './rating';
import { ProgramReviews } from './rating/types';
import { createWallet } from './user';

/**
 * Create the user wallet document when a new user registers
 */
export const handleNewUser = functions
  .region('europe-west1')
  .auth
  .user()
  .onCreate((user: functions.auth.UserRecord) => {
    const promises = [];
    promises.push(createWallet(db, user));

    return Promise.all(promises).catch((e) => console.log(e.message));
  });

/**
 * Process the donation/cashout request
 */
export const processTransaction = functions
  .region('europe-west1')
  .firestore
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
      snap.ref,
    );

    if (txResult.status === TxStatus.ACCEPTED) {
      console.log(`Request ${snap.id} processed successfully.`);
    } else {
      console.log(`Request ${snap.id} rejected.`);
    }
  });

/**
 * Update the average rating of a program when a rating is written
 */
export const updateOverallRating = functions
  .region('europe-west1')
  .firestore
  .document('reviews/{programId}')
  .onWrite((snap, context) => {
    return updateProgramRating(db, snap.after.data() as ProgramReviews);
  });
