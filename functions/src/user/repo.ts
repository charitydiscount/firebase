import { firestore } from 'firebase-admin';
import { Collections } from '../collections';
import { Roles } from '../entities';
import { User } from './user.model';

export const getUser = async (
  db: firestore.Firestore,
  userId: string,
): Promise<User | undefined> => {
  const userSnap = await db
    .collection(Collections.USERS)
    .doc(userId)
    .get();

  if (!userSnap.exists) {
    return undefined;
  }

  const rolesSnap = await db
    .collection(Collections.ROLES)
    .doc(userId)
    .get();

  const roles = rolesSnap.data() as Roles;

  const user: User = {
    ...(userSnap.data() as User),
    isStaff: !!roles,
  };

  return user;
};

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
