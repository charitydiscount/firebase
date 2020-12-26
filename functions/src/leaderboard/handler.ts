import { firestore } from 'firebase-admin';
import { getUserAchievements } from '../achievements/repo';
import { Collections } from '../collections';
import { UserWallet } from '../tx/types';
import { getUser } from '../user/repo';
import { LeaderboardEntry, LeaderboardTop } from './leaderboard.model';
import { getTopDocument } from './repo';

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
  achievements = achievements.filter((value) => {
    return value.achieved;
  });

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

export const updateLeaderboardTop = async (
  db: firestore.Firestore,
  entry: LeaderboardEntry,
) => {
  const topSnap = await getTopDocument(db);
  const top = topSnap.data() as LeaderboardTop;

  if (entry.points <= top.lowestPoints) {
    return;
  }

  const entries = top.entries.concat(...[entry]);
  entries.sort((e1, e2) => e2.points - e1.points);
  const newTopEntries = entries.slice(0, top.totalCount);

  await topSnap.ref.update({
    lowestPoints: newTopEntries[newTopEntries.length - 1].points,
    entries: newTopEntries,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
};
