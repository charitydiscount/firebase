import * as RatingTypes from './types';
import { Firestore } from '@google-cloud/firestore';

export function updateProgramRating(
  db: Firestore,
  reviews: RatingTypes.ProgramReviews
) {
  const reviewsArray = Object.values(reviews.reviews);
  const totalRating = reviewsArray
    .map((review) => review.rating)
    .reduce((r1, r2) => r1 + r2, 0);
  const count = reviewsArray.length;
  const rating = totalRating / count;

  return db
    .collection('meta')
    .doc('programs')
    .set(
      {
        ratings: {
          [`${reviews.shopUniqueCode}`]: {
            count,
            rating,
          },
        },
      },
      { merge: true }
    );
}
