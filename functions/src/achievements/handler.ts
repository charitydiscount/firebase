import { firestore } from 'firebase-admin';
import { pubsub } from 'firebase-functions';
import { FirestoreCollections } from '../collections';
import { Click } from '../entities';
import {
  Achievement,
  AchievementCondition,
  UserAchievement,
  UserAchievements,
} from './achievement.model';
import { AchievementConditionType, AchievementType } from './types';

export const handleAchievementMessage = async (
  message: pubsub.Message,
  db: firestore.Firestore,
) => {
  switch (message.attributes['type']) {
    case AchievementType.CLICK:
      await handleClick(message.json, db, message.attributes['userId']);
      break;
    default:
      break;
  }
};

const handleClick = async (
  click: Click,
  db: firestore.Firestore,
  userId: string,
) => {
  const clickAchievementsSnaps = await db
    .collection(FirestoreCollections.ACHIEVEMENTS)
    .where('type', '==', AchievementType.CLICK)
    .get();

  if (clickAchievementsSnaps.empty) {
    return;
  }

  const clickAchievements: Achievement[] = clickAchievementsSnaps.docs.map(
    (doc) => ({ ...doc.data(), id: doc.id } as Achievement),
  );

  const currentAchievementsSnap = await db
    .collection(FirestoreCollections.USER_ACHIEVEMENTS)
    .doc(userId)
    .get();
  const currentAchievements: UserAchievements =
    currentAchievementsSnap.data() || {};

  const userAchievements: UserAchievements = {};
  clickAchievements.forEach((achievement) => {
    const current = currentAchievements[achievement.id];
    if (current && current.achieved) {
      return;
    }

    userAchievements[achievement.id] = handleClickAchievement(
      click,
      achievement,
      current,
    );
  });

  await db
    .collection(FirestoreCollections.USER_ACHIEVEMENTS)
    .doc(userId)
    .set({ userId, ...userAchievements }, { merge: true });
};

const handleClickAchievement = (
  click: Click,
  achievement: Achievement,
  userAchievement: UserAchievement,
): UserAchievement => {
  const alreadyVisitedShops = userAchievement
    ? (userAchievement.additionalData as string[])
    : [];
  if (
    alreadyVisitedShops.find(
      (visitedShopId) => visitedShopId === click.programId.toString(),
    ) !== undefined
  ) {
    // Shop already visited
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
        result = handleCountCondition(c, userAchievement, 1);
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
    additionalData: alreadyVisitedShops.concat(...[click.programId.toString()]),
    achievedAt: firestore.FieldValue.serverTimestamp(),
  };
};

const handleCountCondition = (
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
