import { firestore } from 'firebase-admin';

export interface LeaderboardEntry {
  userId: string;
  name: string;
  photoUrl: string;
  points: number;
  updatedAt: firestore.Timestamp | firestore.FieldValue;
  isStaff: boolean;
  achievementsCount: number;
  privateName?: boolean;
  privatePhoto?: boolean;
}

export interface LeaderboardTop {
  totalCount: number;
  lowestPoints: number;
  entries: LeaderboardEntry[];
  updatedAt: firestore.Timestamp | firestore.FieldValue;
}
