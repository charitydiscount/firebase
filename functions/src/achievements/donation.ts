import { TxRequest } from '../tx/types';
import { Achievement, UserAchievement } from './achievement.model';
import { handleSimpleCountAchievements } from './common';

export const handleDonation = (
  donation: TxRequest,
  achievement: Achievement,
  userAchievement: UserAchievement,
): UserAchievement =>
  handleSimpleCountAchievements(
    achievement,
    userAchievement,
    donation.id.toString(),
    1,
  );
