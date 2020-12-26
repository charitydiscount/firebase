import { firestore, auth } from 'firebase-admin';
import { ReferralRequest, Referral } from '../entities';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import moment = require('moment');
import { deleteUserData } from './delete';
import { publishMessage } from '../achievements/pubsub';
import { AchievementType } from '../achievements/types';
import { Collections } from '../collections';
import { User } from './user.model';
import { getUserReviews } from '../rating/repo';
import { getUserLeaderboardEntry } from '../leaderboard/repo';
import { userToReviewer } from './mapper';
import { getReferralEntry } from './repo';

export const createUser = (db: firestore.Firestore, user: auth.UserRecord) =>
  db
    .collection(Collections.USERS)
    .doc(user.uid)
    .create({
      email: user.email,
      name: user.displayName || null,
      photoUrl: user.photoURL,
      userId: user.uid,
    });

export const createWallet = (db: firestore.Firestore, userId: string) =>
  db
    .collection(Collections.WALLETS)
    .doc(userId)
    .create({
      cashback: {
        approved: 0.0,
        pending: 0.0,
      },
      points: {
        approved: 0.0,
        pending: 0.0,
      },
      userId,
    });

export const handleReferral = async (
  db: firestore.Firestore,
  requestSnap: DocumentSnapshot,
) => {
  const referralRequest = requestSnap.data() as ReferralRequest;
  if (!referralRequest) {
    console.log('Undefined referral request');
    return;
  }

  // Ensure that the new user is not already referred
  const existingReferral = await getReferralEntry(
    db,
    referralRequest.newUserId,
  );
  if (existingReferral) {
    console.log(`User ${referralRequest.newUserId} already referred`);
    return requestSnap.ref.update({ valid: false, reason: 'Already referred' });
  }

  // Get the new/referred user
  let newUser: auth.UserRecord;
  try {
    newUser = await auth().getUser(referralRequest.newUserId);
  } catch (error) {
    return requestSnap.ref.update({
      valid: false,
      reason: 'User not found',
    });
  }

  // Ensure that the referred user is recently created
  if (
    moment().diff(moment(newUser.metadata.creationTime)) > 3600000 //1 hour
  ) {
    console.log(`User not recent enough`);
    return requestSnap.ref.update({
      valid: false,
      reason: 'User not recent enough',
    });
  }

  // Get the user who's referral code is used
  let referralUser: auth.UserRecord;
  try {
    referralUser = await getUserForReferral(referralRequest);
  } catch (e) {
    console.log(
      `Failed to retrieve user for referral code ${referralRequest.referralCode}`,
    );
    return requestSnap.ref.update({
      valid: false,
      reason: 'Referral not found',
    });
  }

  try {
    await publishMessage(
      AchievementType.INVITE,
      {
        referralUser: referralUser.uid,
        invitedUser: newUser.uid,
        invitedAt: referralRequest.createdAt,
      },
      referralUser.uid,
    );
  } catch (error) {
    console.log(
      `Failed to publish message for user referral: ${error.message || error}`,
    );
  }

  await requestSnap.ref.update({
    valid: true,
  });

  return db.collection('referrals').add(<Referral>{
    ownerId: referralUser.uid,
    userId: newUser.uid,
    name: newUser.displayName,
    photoUrl: newUser.photoURL || null,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
};

const getUserForReferral = (referralRequest: ReferralRequest) =>
  auth().getUser(referralRequest.referralCode);

export const handleUserDelete = deleteUserData;

/**
 * Update the denormalized user data across all relevant collections:
 * - reviews
 * - leaderboard
 * - referrals
 */
export const handleUserConsistency = async (
  db: firestore.Firestore,
  user: User,
) => {
  // Update in reviews
  const batch = db.batch();

  const reviewsSnap = await getUserReviews(db, user.userId);
  if (!reviewsSnap.empty) {
    const reviewer = userToReviewer(user);
    for (const reviewSnap of reviewsSnap.docs) {
      batch.update(reviewSnap.ref, {
        [`reviews.${user.userId}.reviewer`]: reviewer,
      });
    }
  }

  // Update in leaderboard
  const entrySnap = await getUserLeaderboardEntry(db, user.userId);
  if (entrySnap.exists) {
    batch.update(entrySnap.ref, userToReviewer(user));
  }

  // Update in referrals
  const referralEntry = await getReferralEntry(db, user.userId);
  if (referralEntry) {
    batch.update(referralEntry.ref, {
      name: user.name,
      photoUrl: user.photoUrl,
    });
  }

  await batch.commit();
};
