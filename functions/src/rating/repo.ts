import { firestore } from 'firebase-admin';
import { Collections } from '../collections';

export const getUserReviews = (db: firestore.Firestore, userId: string) =>
  db
    .collection(Collections.REVIEWS)
    .where(`reviews.${userId.trim()}`, '!=', null)
    .get();
