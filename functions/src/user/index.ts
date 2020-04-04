import { firestore, auth } from 'firebase-admin';
import { ReferralRequest, Referral } from '../entities';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import moment = require('moment');
import { deleteUserData } from './delete';

export const createUser = (db: firestore.Firestore, user: auth.UserRecord) =>
  db.collection('users').doc(user.uid).create({
    email: user.email,
    name: user.displayName,
    photoUrl: user.photoURL,
    userId: user.uid,
  });

export const createWallet = (db: firestore.Firestore, user: auth.UserRecord) =>
  db
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
  const existingReferrals = await db
    .collection('referrals')
    .where('userId', '==', referralRequest.newUserId)
    .get();
  if (!existingReferrals.empty) {
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
