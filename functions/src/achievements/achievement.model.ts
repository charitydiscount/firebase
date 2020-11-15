import { firestore } from 'firebase-admin';
import {
  AchievementConditionType,
  AchievementConditionUnit,
  AchievementType,
} from './types';

export interface Achievement {
  id: string;
  badge: string;
  conditions: AchievementCondition[];
  createdAt: firestore.Timestamp | firestore.FieldValue;
  updatedAt: firestore.Timestamp | firestore.FieldValue;
  description: string;
  name: string;
  reward: AchievementReward;
  order: number;
  type: AchievementType;
  weight: number;
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
