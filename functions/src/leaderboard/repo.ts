import { firestore } from 'firebase-admin';
import { Collections } from '../collections';

export const updateLeaderboardEntry = async (
  db: firestore.Firestore,
  entry: any,
  userId: string,
) =>
  db
    .collection(Collections.LEADERBOARD)
    .doc(userId)
    .set(
      { ...entry, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
