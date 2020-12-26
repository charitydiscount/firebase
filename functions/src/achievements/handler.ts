import { firestore } from 'firebase-admin';
import { pubsub } from 'firebase-functions';
import { Collections } from '../collections';
import { TxStatus } from '../tx/types';
import {
  Achievement,
  AchievementRewardRequest,
  UserAchievement,
  UserAchievements,
} from './achievement.model';
import { handleCashout } from './cashout';
import { handleClickAchievement } from './click';
import { handleCommission } from './commission';
import { getAchievements, getCurrentUserAchievements } from './common';
import { handleDonation } from './donation';
import { handleInvite } from './invite';
import { AchievementType } from './types';

const HANDLED_ACHIEVEMENTS = [
  AchievementType.CLICK,
  AchievementType.COMMISSION_PENDING,
  AchievementType.COMMISSION_PAID,
  AchievementType.DONATION,
  AchievementType.CASHOUT,
  AchievementType.INVITE,
];

export const handleAchievementMessage = async (
  message: pubsub.Message,
  db: firestore.Firestore,
) => {
  const type = message.attributes['type'] as AchievementType;
  if (!HANDLED_ACHIEVEMENTS.find((a) => a === type)) {
    console.log(`Unhandled achievement type ${type}`);
    return;
  }

  const userId = message.attributes['userId'];

  const achievements = await getAchievements(db, type);
  if (!achievements) {
    return;
  }

  const currentAchievements = await getCurrentUserAchievements(db, userId);

  const userAchievements: UserAchievements = {};
  for (const achievement of achievements) {
    const current = currentAchievements[achievement.id];
    if (current && current.achieved) {
      continue;
    }

    try {
      userAchievements[achievement.id] = processAchievement(
        type,
        message,
        achievement,
        current,
      );
    } catch (error) {
      console.error(error.message || error);
      continue;
    }

    if (userAchievements[achievement.id].achieved) {
      // Initiate the reward request
      const rewardRequest: AchievementRewardRequest = {
        achievement: achievement,
        createdAt: firestore.FieldValue.serverTimestamp(),
        userId: userId,
        status: TxStatus.PENDING,
      };
      await db
        .collection(Collections.REWARD_REQUESTS)
        .doc(`${userId}_${achievement.id}`)
        .set(rewardRequest);
    }
  }

  await db
    .collection(Collections.USER_ACHIEVEMENTS)
    .doc(userId)
    .set({ userId, ...userAchievements }, { merge: true });
};

const processAchievement = (
  type: AchievementType,
  message: any,
  achievement: Achievement,
  userAchievement: UserAchievement,
) => {
  switch (type) {
    case AchievementType.CLICK:
      return handleClickAchievement(message.json, achievement, userAchievement);
    case AchievementType.COMMISSION_PENDING:
    case AchievementType.COMMISSION_PAID:
      return handleCommission(message.json, achievement, userAchievement);
    case AchievementType.DONATION:
      return handleDonation(message.json, achievement, userAchievement);
    case AchievementType.CASHOUT:
      return handleCashout(message.json, achievement, userAchievement);
    case AchievementType.INVITE:
      return handleInvite(message.json, achievement, userAchievement);
    default:
      throw new Error(`Unhandled achievement type ${type}`);
  }
};
