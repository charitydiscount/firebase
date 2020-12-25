import { firestore } from 'firebase-admin';

export interface Reviewer {
  userId: string;
  name: string;
  photoUrl: string;
  privateName?: boolean;
  privatePhoto?: boolean;
}

export interface Review {
  reviewer: Reviewer;
  rating: number;
  description: string;
  createdAt: firestore.Timestamp;
}

export interface ProgramReviews {
  shopUniqueCode: string;
  reviews: { [userId: string]: Review };
}

export interface ProgramOverallRating {
  rating: number;
  count: number;
}
