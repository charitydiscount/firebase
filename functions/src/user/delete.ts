import { firestore, storage } from 'firebase-admin';
import { UserRecord } from 'firebase-functions/lib/providers/auth';
import { isDev } from '../util';
import { sendEmail } from '../email';
import { deleteAccountMailBody } from '../email/content';
import { deleteUser as deleteUserFromElastic } from '../elastic';
import { Collections } from '../collections';
import { getUserReviews } from '../rating/repo';
import { getUserLeaderboardEntry } from '../leaderboard/repo';
import { getReferralEntry } from './repo';

/**
 * - send email
 * - delete info from favorite shops
 * - Anonymize info from referrals
 * - delete info from users
 * - delete info from storage
 * - delete achievements and leaderboard entry
 */
export const deleteUserData = async (
  db: firestore.Firestore,
  user: UserRecord,
) => {
  if (user.email) {
    await sendEmail(user.email, 'Cerere ștergere cont', deleteAccountMailBody);
  }

  await deleteDoc(db.collection('favoriteShops').doc(user.uid));

  // Delete referrals of the user (he/she invited others)
  const referredUsers = await db
    .collection('referrals')
    .where('ownerId', '==', user.uid)
    .get();
  for (const doc of referredUsers.docs) {
    await doc.ref.delete();
  }

  // Anonymize invitation of the user (he/she was invited)
  const ownReferral = await getReferralEntry(db, user.uid);
  if (ownReferral) {
    await ownReferral.ref.update({
      name: '-',
      photoUrl: null,
    });
  }

  // Anonymize user's reviews
  const shopReviews = await getUserReviews(db, user.uid);
  for (const doc of shopReviews.docs) {
    await doc.ref.update({
      [`reviews.${user.uid}.reviewer.name`]: '-',
      [`reviews.${user.uid}.reviewer.photoUrl`]: null,
    });
  }

  // Delete user's device tokens
  const userRef = db.collection('users').doc(user.uid);
  const tokenDocs = await userRef.collection('tokens').listDocuments();
  for (const doc of tokenDocs) {
    await doc.delete();
  }

  // Delete user's bank accounts
  const accountDocs = await userRef.collection('accounts').listDocuments();
  for (const doc of accountDocs) {
    await doc.delete();
  }

  // Delete user from leaderboard if exists
  const leaderboardRef = await getUserLeaderboardEntry(db, user.uid);
  if (leaderboardRef.exists) {
    await leaderboardRef.ref.delete();
  }

  // Delete user achievements
  const achievementsRef = await db
    .collection(Collections.USER_ACHIEVEMENTS)
    .doc(user.uid)
    .get();
  if (achievementsRef.exists) {
    await achievementsRef.ref.delete();
  }

  // Delete user document
  await userRef.delete();

  // Delete user profile picture
  const filePath = `profilePhotos/${user.uid}/profilePicture.png`;
  const bucket = storage().bucket(
    isDev ? 'charitydiscount-test.appspot.com' : 'charitydiscount.appspot.com',
  );
  const file = bucket.file(filePath);

  const fileExists = await file.exists();
  if (fileExists[0] === true) {
    try {
      await file.delete();
    } catch (e) {
      console.log(`Failed to delete photo, error: ${e}`);
    }
  }

  await deleteUserFromElastic(user);

  return true;
};

const deleteDoc = async (doc: firestore.DocumentReference) =>
  doc.delete().catch();
