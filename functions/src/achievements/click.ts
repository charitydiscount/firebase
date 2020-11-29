import { Click } from '../entities';
import { Achievement, UserAchievement } from './achievement.model';
import { handleSimpleCountAchievements } from './common';

export const handleClickAchievement = (
  click: Click,
  achievement: Achievement,
  userAchievement: UserAchievement,
): UserAchievement =>
  handleSimpleCountAchievements(
    achievement,
    userAchievement,
    click.programId.toString(),
    1,
  );
