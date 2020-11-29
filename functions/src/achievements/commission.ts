import { Commission } from '../entities';
import { Achievement, UserAchievement } from './achievement.model';
import { handleSimpleCountAchievements } from './common';

export const handleCommission = (
  commission: Commission,
  achievement: Achievement,
  userAchievement: UserAchievement,
): UserAchievement =>
  handleSimpleCountAchievements(
    achievement,
    userAchievement,
    commission.originId.toString(),
    1,
  );
