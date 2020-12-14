import { firestore } from 'firebase-admin';
import { Roles } from '../entities';
import { updateLeaderboardEntry } from '../leaderboard/repo';
import { updateUser } from '../user/repo';

export const updateStaff = async (
  db: firestore.Firestore,
  roles: Roles,
  userId: string,
) => {
  const isStaff = !!roles && roles.admin === true;

  await updateUser(db, { staff: isStaff }, userId);
  await updateLeaderboardEntry(db, { isStaff }, userId);
};
