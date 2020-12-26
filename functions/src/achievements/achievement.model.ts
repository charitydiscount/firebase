import { firestore } from 'firebase-admin';
import { LocalizedText } from '../entities';
import { TxStatus } from '../tx/types';
import {
  AchievementConditionType,
  AchievementConditionUnit,
  AchievementType,
} from './types';

export interface Achievement {
  id: string;
  badgeUrl: string;
  conditions: AchievementCondition[];
  createdAt: firestore.Timestamp | firestore.FieldValue;
  updatedAt: firestore.Timestamp | firestore.FieldValue;
  description: LocalizedText;
  name: LocalizedText;
  reward: AchievementReward;
  order: number;
  type: AchievementType;
  targetDate?: Date;
  exactDate?: boolean;
}

export interface AchievementCondition {
  target: number | Date | string;
  type: AchievementConditionType;
  unit: AchievementConditionUnit;
}

export interface AchievementReward {
  amount: number;
  unit: string;
}

export type UserAchievements = {
  [achievementId: string]: UserAchievement;
} & {
  userId?: string;
};

export interface UserAchievement {
  achievement: Achievement;
  currentCount: number | firestore.FieldValue;
  achieved?: boolean;
  achievedAt?: firestore.Timestamp | firestore.FieldValue;
  additionalData?: any;
}

export interface AchievementRewardRequest {
  userId: string;
  achievement: Achievement;
  createdAt: firestore.Timestamp | firestore.FieldValue;
  status: TxStatus;
  reason?: string;
}

export interface InviteData {
  referralUser: string;
  invitedUser: string;
  invitedAt: firestore.Timestamp;
}
