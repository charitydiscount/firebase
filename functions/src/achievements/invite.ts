import { Achievement, InviteData, UserAchievement } from './achievement.model';
import { handleSimpleCountAchievements } from './common';

export const handleInvite = (
  invite: InviteData,
  achievement: Achievement,
  userAchievement: UserAchievement,
): UserAchievement =>
  handleSimpleCountAchievements(
    achievement,
    userAchievement,
    invite.invitedUser,
    1,
  );
