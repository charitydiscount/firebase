import { firestore } from 'firebase-admin';
import { getUserAchievements } from '../achievements/repo';
import { Collections } from '../collections';
import { UserWallet } from '../tx/types';
import { getUser } from '../user/repo';
import { LeaderboardEntry } from './leaderboard.model';

export const updateLeaderboard = async (
  db: firestore.Firestore,
  wallet: UserWallet | undefined,
  userId: string,
) => {
  const points = wallet?.points?.approved ?? 0;
  const user = await getUser(db, userId);

  if (!user) {
    console.error(`No user entry for uid ${userId}`);
    return;
  }

  let achievements = await getUserAchievements(db, userId);
  //count only achieved entries
  achievements = achievements.filter(value => { return value.achieved});

  const entry: LeaderboardEntry = {
    achievementsCount: achievements.length,
    isStaff: user.isStaff,
    name: `${user.name}`,
    photoUrl: user.photoUrl,
    points: points,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    userId,
  };

  await db
    .collection(Collections.LEADERBOARD)
    .doc(userId)
    .set(entry, { merge: true });
};
