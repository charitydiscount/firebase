import { Timestamp } from '@google-cloud/firestore';

export interface Reviewer {
  userId: string;
  name: string;
  photoUrl: string;
}

export interface Review {
  reviewer: Review;
  rating: number;
  description: string;
  createdAt: Timestamp;
}

export interface ProgramReviews {
  shopUniqueCode: string;
  reviews: Review[];
}

export interface ProgramOverallRating {
  rating: number;
  count: number;
}
