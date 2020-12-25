import { firestore } from 'firebase-admin';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  photoUrl: string;
  points: number;
  updatedAt: firestore.Timestamp | firestore.FieldValue;
  isStaff: boolean;
  achievementsCount: number;
  anonym?: boolean;
}

export interface LeaderboardTop {
  totalCount: number;
  lowestPoints: number;
  entries: LeaderboardEntry[];
  updatedAt: firestore.Timestamp | firestore.FieldValue;
}
