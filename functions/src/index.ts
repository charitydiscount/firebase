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
import { TxStatus, UserWallet } from './tx/types';
import { handleProgramReview } from './rating';
import { createUser, handleReferral, handleUserDelete } from './user';
import { handleNewOtp } from './otp';
import { updateWallet } from './tx/commission';
import searchApp from './search';
import { updateCommissions } from './commissions';
import authApp from './auth';
import { updatePrograms as refreshPrograms } from './programs/program';
import { updatePromotions as updateProms } from './programs/promotions';
import adminApp from './admin';
import { Click, Commission, ProgramReviews, Roles } from './entities';
import { saveUser as saveUserToElastic } from './elastic';
import { handleClick } from './clicks';
import { handleAchievementMessage } from './achievements/handler';
import { Collections } from './collections';
import { handleRewardRequest } from './achievements/rewards';
import { updateLeaderboard } from './leaderboard/handler';
import { updateStaff } from './roles';

const fun = () => functions.region('europe-west1');

/**
 * Create the user wallet document when a new user registers
 */
export const handleNewUser = fun()
  .auth.user()
  .onCreate(async (user: functions.auth.UserRecord) => {
    try {
      await Promise.all([createUser(db, user), saveUserToElastic(user)]);
    } catch (error) {
      console.error(error.message);
    }
  });

/**
 * Process the donation/cashout request
 */
export const processTransaction = fun()
  .firestore.document('requests/{requestId}')
  .onCreate(async (snap) => {
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
export const updateOverallRating = fun()
  .firestore.document('reviews/{programId}')
  .onWrite((snap) => {
    return handleProgramReview(
      db,
      snap.before.data() as ProgramReviews,
      snap.after.data() as ProgramReviews,
    );
  });

/**
 * Handle the one-time password requests
 */
export const generateOtp = fun()
  .firestore.document('otp-requests/{userId}')
  .onWrite(async (snap) => {
    const userId = snap.after.id;
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(userId);
    } catch (e) {
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
export const updateUserWallet = fun()
  .firestore.document('commissions/{userId}')
  .onWrite((snap) => {
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

export const search = fun().https.onRequest(searchApp);

export const auth = fun().https.onRequest(authApp);

const commissionsInterval =
  admin.instanceId().app.options.projectId === 'charitydiscount-test'
    ? '24 hours'
    : '10 minutes';

export const updateCommissionsFromApi = fun()
  .runWith({
    memory: '512MB',
  })
  .pubsub.schedule(`every ${commissionsInterval}`)
  .timeZone('Europe/Bucharest')
  .onRun((_: any) => {
    return updateCommissions(db);
  });

export const updatePrograms = fun()
  .pubsub.schedule('every 24 hours')
  .timeZone('Europe/Bucharest')
  .onRun((_: any) => refreshPrograms(db));

export const updatePromotions = fun()
  .pubsub.schedule('every 12 hours')
  .timeZone('Europe/Bucharest')
  .onRun((_: any) => updateProms(db));

export const manage = functions
  .region('europe-west1')
  .https.onRequest(adminApp);

/**
 * Create the referral relationship
 */
export const handleReferralRequest = fun()
  .firestore.document('referral-requests/{requestId}')
  .onCreate((snap) => handleReferral(db, snap));

/**
 * Remove all PII of the deleted user and donate any available cashback left
 */
export const onUserDelete = fun()
  .auth.user()
  .onDelete((user) => handleUserDelete(db, user));

/**
 * Handle shop clicks
 */
export const onClick = fun()
  .firestore.document('clicks/{clickId}')
  .onCreate((snap) => handleClick(snap.data() as Click));

/**
 * Handle all achievement related messages
 */
export const onAchievementMessage = fun()
  .pubsub.topic('achievements')
  .onPublish((message) => handleAchievementMessage(message, db));

/**
 * Handle achievement rewards
 */
export const onRewardRequest = fun()
  .firestore.document(`${Collections.REWARD_REQUESTS}/{requestId}`)
  .onCreate((snap) => handleRewardRequest(db, snap));

/**
 * Handle leaderboard update based on CharityPoints
 */
export const onWalletUpdate = fun()
  .firestore.document(`${Collections.WALLETS}/{userId}`)
  .onUpdate((snap) => {
    const walletBefore = snap.before.data() as UserWallet;
    const walletAfter = snap.after.data() as UserWallet;

    if (
      walletBefore &&
      walletAfter &&
      walletBefore.points.approved === walletAfter.points.approved
    ) {
      // Leaderboard is based on CharityPoints. If no change, no update
      // is needed. This also applies if the wallet was just created
      return;
    }

    return updateLeaderboard(db, walletAfter, snap.after.id);
  });

/**
 * Handle role updates (e.g. update the staff attribute)
 */
export const onRolesUpdate = fun()
  .firestore.document(`${Collections.ROLES}/{userId}`)
  .onWrite((snap) => {
    const roles = snap.after.data() as Roles;

    return updateStaff(db, roles, snap.after.id);
  });

// export const populateAuthUsers = fun().https.onRequest(importUsersInAuth());

// export const findWrongWallets = fun().https.onRequest(async (req, res) => {
//   const missingCommissions = await getWalletsWithMissingCommissions(db);
//   res.header('Content-type', 'application/json');
//   res.status(200).send(JSON.stringify(missingCommissions));
// });
