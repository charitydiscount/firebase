import { TxRequest } from '../tx/types';
import { Achievement, UserAchievement } from './achievement.model';
import { handleSimpleCountAchievements } from './common';

export const handleCashout = (
  cashout: TxRequest,
  achievement: Achievement,
  userAchievement: UserAchievement,
): UserAchievement =>
  handleSimpleCountAchievements(
    achievement,
    userAchievement,
    cashout.id.toString(),
    1,
  );
