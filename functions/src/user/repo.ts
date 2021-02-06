import { auth, firestore } from 'firebase-admin';
import { Collections } from '../collections';
import { Roles } from '../entities';
import { User } from './user.model';

export const getUser = async (
  db: firestore.Firestore,
  userId: string,
): Promise<User | undefined> => {
  const userSnap = await db.collection(Collections.USERS).doc(userId).get();

  if (!userSnap.exists) {
    return undefined;
  }

  const rolesSnap = await db.collection(Collections.ROLES).doc(userId).get();

  const user = userEntryToUser(
    userSnap.data() as any,
    rolesSnap.data() as Roles,
  );

  if (!user.name || !user.photoUrl) {
    const authUser = await auth().getUser(user.userId);
    if (!user.name) {
      user.name = authUser.displayName || '-';
    }
    if (!user.photoUrl) {
      user.photoUrl = authUser.photoURL || '';
    }
  }

  return user;
};

const userEntryToUser = (
  entry: firestore.DocumentData,
  roles: Roles,
): User => ({
  userId: entry.userId,
  disableMailNotification: entry.disableMailNotification,
  email: entry.email,
  name:
    !!entry.firstName || entry.lastName
      ? `${entry.firstName} ${entry.lastName}`.trim()
      : entry.name,
  photoUrl: entry.photoUrl,
  isStaff: !!roles,
  privateName: entry.privateName,
  privatePhoto: entry.privatePhoto,
});

/**
 * Update a given user with the provided fields
 * @param db firestore reference
 * @param user User with new attributes (complete or partial)
 * @param userId User ID
 */
export const updateUser = (
  db: firestore.Firestore,
  user: User | any,
  userId: string,
) =>
  db
    .collection(Collections.USERS)
    .doc(userId)
    .set(
      { ...user, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );

export const getReferralEntry = async (
  db: firestore.Firestore,
  userId: string,
) => {
  const existingReferrals = await db
    .collection(Collections.REFERRALS)
    .where('userId', '==', userId)
    .get();

  if (existingReferrals.empty) {
    return undefined;
  }

  return existingReferrals.docs[0];
};
