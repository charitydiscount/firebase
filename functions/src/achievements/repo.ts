import { firestore } from 'firebase-admin';
import { Collections } from '../collections';
import { getEntityWithoutUserId } from '../util';
import { UserAchievement, UserAchievements } from './achievement.model';

export const getUserAchievements = async (
  db: firestore.Firestore,
  userId: string,
): Promise<UserAchievement[]> => {
  const snap = await db
    .collection(Collections.USER_ACHIEVEMENTS)
    .doc(userId)
    .get();

  if (!snap.exists) {
    return [];
  }

  const userAchievements = snap.data() as UserAchievements;

  return getEntityWithoutUserId(userAchievements);
};
