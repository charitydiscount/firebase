import { firestore } from 'firebase-admin';
import { FirestoreCollections } from '../collections';
import {
  Achievement,
  AchievementCondition,
  UserAchievement,
  UserAchievements,
} from './achievement.model';
import { AchievementConditionType, AchievementType } from './types';

export const getAchievements = async (
  db: firestore.Firestore,
  type: AchievementType,
): Promise<Achievement[] | undefined> => {
  const clickAchievementsSnaps = await db
    .collection(FirestoreCollections.ACHIEVEMENTS)
    .where('type', '==', type)
    .get();

  if (clickAchievementsSnaps.empty) {
    return;
  }

  return clickAchievementsSnaps.docs.map(
    (doc) => ({ ...doc.data(), id: doc.id } as Achievement),
  );
};

export const getCurrentUserAchievements = async (
  db: firestore.Firestore,
  userId: string,
): Promise<UserAchievements> => {
  const currentAchievementsSnap = await db
    .collection(FirestoreCollections.USER_ACHIEVEMENTS)
    .doc(userId)
    .get();
  const currentAchievements: UserAchievements =
    currentAchievementsSnap.data() || {};
  return currentAchievements;
};

export const handleCountCondition = (
  condition: AchievementCondition,
  currentAchievement: UserAchievement,
  increment: number,
) => {
  const newCount =
    ((currentAchievement?.currentCount || 0) as number) + increment;

  return {
    newCount,
    countAchieved: condition.target <= newCount,
  };
};

export const handleSimpleCountAchievements = (
  achievement: Achievement,
  userAchievement: UserAchievement,
  entityId: string,
  increment: number = 1,
): UserAchievement => {
  const alreadyHandledEntities = userAchievement
    ? (userAchievement.additionalData as string[])
    : [];
  if (
    alreadyHandledEntities.find((commissionId) => commissionId === entityId)
  ) {
    // Entity already considered
    return userAchievement;
  }

  let conditionsResult = {
    newCount: 0,
    countAchieved: false,
  };
  achievement.conditions.forEach((c) => {
    let result: any;
    switch (c.type) {
      case AchievementConditionType.COUNT:
        result = handleCountCondition(c, userAchievement, increment);
        break;
      default:
        throw new Error(`Unhandled condition type: ${c.type}`);
    }
    conditionsResult = { ...conditionsResult, ...result };
  });

  return {
    achieved: conditionsResult.countAchieved,
    achievement: achievement,
    currentCount: conditionsResult.newCount,
    additionalData: alreadyHandledEntities.concat(...[entityId]),
    achievedAt: firestore.FieldValue.serverTimestamp(),
  };
};
