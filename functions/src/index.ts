import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(process.env.FIREBASE_SERVICE_ACCOUNT),
    ),
    databaseURL: 'https://charitydiscount.firebaseio.com',
  });
} else {
  admin.initializeApp();
}
const db = admin.firestore();

import { processTx } from './tx';
import { TxStatus, Commission } from './tx/types';
import { updateProgramRating } from './rating';
import { createWallet, createUser } from './user';
import { handleNewOtp } from './otp';
import { updateWallet } from './tx/commission';
import searchApp from './search';
import commissionsUtil, { updateCommissions } from './commissions';
import programsApp from './programs';
import authApp from './auth';
import { updatePrograms as refreshPrograms } from './programs/program';
import { updatePromotions as updateProms } from './programs/promotions';
import adminApp from './admin';

/**
 * Create the user wallet document when a new user registers
 */
export const handleNewUser = functions
  .region('europe-west1')
  .auth.user()
  .onCreate((user: functions.auth.UserRecord) =>
    Promise.all([createUser(db, user), createWallet(db, user)]).catch((e) =>
      console.log(e.message),
    ),
  );

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
        target:
          typeof tx.target === 'string'
            ? { id: tx.target, name: '' }
            : tx.target,
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
  .storage.bucket(commissionsUtil.bucket.name)
  .object()
  .onFinalize((object) =>
    commissionsUtil.updateCommissionFromBucket(db, object),
  );

export const search = functions
  .region('europe-west1')
  .https.onRequest(searchApp);

export const programs = functions
  .region('europe-west1')
  .https.onRequest(programsApp);

export const auth = functions.region('europe-west1').https.onRequest(authApp);

const commissionsInterval =
  admin.instanceId().app.options.projectId === 'charitydiscount-test'
    ? '2 hours'
    : '10 minutes';

export const updateCommissionsFromApi = functions
  .region('europe-west1')
  .pubsub.schedule(`every ${commissionsInterval}`)
  .timeZone('Europe/Bucharest')
  .onRun((context: any) => {
    return updateCommissions(db);
  });

export const updatePrograms = functions
  .region('europe-west1')
  .pubsub.schedule('every 24 hours')
  .timeZone('Europe/Bucharest')
  .onRun((context: any) => refreshPrograms(db));

export const updatePromotions = functions
  .region('europe-west1')
  .pubsub.schedule('every 12 hours')
  .timeZone('Europe/Bucharest')
  .onRun((context: any) => updateProms(db));

export const manage = functions
  .region('europe-west1')
  .https.onRequest(adminApp);
