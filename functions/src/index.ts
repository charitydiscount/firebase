import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

import { processTx } from './tx';
import { TxStatus, Commission } from './tx/types';
import { updateProgramRating } from './rating';
import { createWallet } from './user';
import { handleNewOtp } from './otp';
import { updateWallet } from './tx/commission';
import { Contact, sendContactMessage } from './contact';
import searchApp from './search';
import commissionsUtil from './commissions';
import programsApp from './programs';

/**
 * Create the user wallet document when a new user registers
 */
export const handleNewUser = functions
  .region('europe-west1')
  .auth.user()
  .onCreate(async (user: functions.auth.UserRecord) => {
    try {
      return await createWallet(db, user);
    } catch (e) {
      console.log(e.message);
      return undefined;
    }
  });

/**
 * Process the donation/cashout request
 */
export const processTransaction = functions
  .region('europe-west1')
  .firestore.document('requests/{requestId}')
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
        status: tx.status,
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
  .firestore.document('reviews/{programId}')
  .onWrite((snap, context) => {
    //@ts-ignore
    return updateProgramRating(db, snap.after.data());
  });

/**
 * Handle the one-time password requests
 */
export const generateOtp = functions
  .region('europe-west1')
  .firestore.document('otp-requests/{userId}')
  .onWrite(async (snap, context) => {
    const userId = snap.after.id;
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(userId);
    } catch (e) {
      // user doesn't exist
      console.log(`User ${userId} doesn't exist`);
      return;
    }

    // throttle the otp generation (30 seconds)
    const userOtp = await db.doc(`otps/${userId}`).get();
    if (userOtp.exists) {
      const lastGenerated = userOtp.data()!.generatedAt.toMillis();
      const now = admin.firestore.Timestamp.now().toMillis();
      if (lastGenerated + 30000 > now) {
        console.log(`Request throttled`);
        return;
      }
    }

    return handleNewOtp(db, userRecord);
  });

/**
 * Update the user wallet on commissions update
 */
export const updateUserWallet = functions
  .region('europe-west1')
  .firestore.document('commissions/{userId}')
  .onWrite((snap, context) => {
    if (!snap.after.exists) {
      return;
    }

    const uid = snap.after.id;
    let previousCommissions: Commission[] = [];
    if (snap.before.exists) {
      previousCommissions = getUserCommissions(
        <
          {
            userId: string;
            [commissionId: number]: Commission;
          }
        >snap.before.data(),
      );
    }
    const commissions = getUserCommissions(
      <
        {
          userId: string;
          [commissionId: number]: Commission;
        }
      >snap.after.data(),
    );

    if (!commissions) {
      console.log(`No commissions for user ${uid}`);
      return;
    }

    return updateWallet(
      db,
      uid,
      Object.values(commissions),
      previousCommissions,
    );
  });

const getUserCommissions = (commissions: {
  userId: string;
  [commissionId: number]: Commission;
}) => {
  const { userId, ...commissionsMap } = commissions;
  return Object.values(commissionsMap);
};

export const updateCommissionsFromStorage = functions
  .region('europe-west1')
  .storage.bucket(commissionsUtil.commissionsBucketName)
  .object()
  .onFinalize((object) =>
    commissionsUtil.updateCommissionFromBucket(db, object),
  );

export const sendContactMail = functions
  .region('europe-west1')
  .firestore.document('contact/{randomId}')
  .onCreate((snap, context) => {
    return sendContactMessage(db, snap.id, snap.data() as Contact);
  });

export const search = functions
  .region('europe-west1')
  .https.onRequest(searchApp);

export const programs = functions
  .region('europe-west1')
  .https.onRequest(programsApp);
