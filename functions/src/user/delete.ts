import { firestore, storage } from 'firebase-admin';
import { UserRecord } from 'firebase-functions/lib/providers/auth';
import { isDev } from '../util';
import { sendEmail } from '../email';
import { deleteAccountMailBody } from '../email/content';
import { deleteUser as deleteUserFromElastic } from '../elastic';

/**
 * - send email
 * - delete info from favorite shops
 * - Anonymize info from referrals
 * - delete info from users
 * - delete info from storage
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
  const ownReferrals = await db
    .collection('referrals')
    .where('userId', '==', user.uid)
    .get();
  for (const doc of ownReferrals.docs) {
    await doc.ref.update({
      name: '-',
      photoUrl: null,
    });
  }

  // Anonymize user's reviews
  const shopReviews = await db
    .collection('reviews')
    .where(`reviews.${user.uid}`, '>', '')
    .get();
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
