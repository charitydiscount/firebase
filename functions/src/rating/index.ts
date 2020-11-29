import * as entities from '../entities';
import { firestore } from 'firebase-admin';
import { publishMessage } from '../achievements/pubsub';
import { AchievementType } from '../achievements/types';

export const handleProgramReview = async (
  db: firestore.Firestore,
  before: entities.ProgramReviews | undefined,
  after: entities.ProgramReviews | undefined,
) => {
  if (!after) {
    return;
  }

  await updateProgramRating(db, after);

  // Send the new review for achievements
  for (const userId in after.reviews) {
    if (!before || !before.reviews[userId]) {
      await publishMessage(
        AchievementType.REVIEW,
        after.reviews[userId],
        userId,
      );
    }
  }
};

function updateProgramRating(
  db: firestore.Firestore,
  reviews: entities.ProgramReviews,
) {
  const reviewsArray = Object.values(reviews.reviews || {});
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
      { merge: true },
    );
}
