import { firestore } from 'firebase-admin';
import { Collections } from '../collections';
import { LeaderboardTop } from './leaderboard.model';

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

export const getTopDocument = async (db: firestore.Firestore) => {
  const snap = await db.collection(Collections.LEADERBOARD).doc('top').get();
  if (!snap.exists) {
    const initialTop: LeaderboardTop = {
      totalCount: 10,
      lowestPoints: 0,
      entries: [],
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    await snap.ref.set(initialTop);
  }

  return snap;
};
