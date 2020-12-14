import { firestore } from 'firebase-admin';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  photoUrl: string;
  points: number;
  updatedAt: firestore.Timestamp | firestore.FieldValue;
  isStaff: boolean;
  achievementsCount: number;
}
