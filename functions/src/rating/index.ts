import { firestore } from 'firebase-admin';
import { publishMessage } from '../achievements/pubsub';
import { AchievementType } from '../achievements/types';
import { ProgramReviews } from './review.model';
import { isEqual } from 'lodash';

export const handleProgramReview = async (
  db: firestore.Firestore,
  before: ProgramReviews | undefined,
  after: ProgramReviews | undefined,
) => {
  if (!after || !isRelevantChange(before, after)) {
    return;
  }

  console.log(`Handling reviews for ${after?.shopUniqueCode}`);

  await updateProgramRating(db, after);

  // Send the new review for achievements
  for (const userId in after.reviews) {
    if (!before || !before.reviews[userId]) {
      console.log(`New program review by user ${userId}`);
      await publishMessage(
        AchievementType.REVIEW,
        after.reviews[userId],
        userId,
      );
    }
  }
};

function isRelevantChange(
  before: ProgramReviews | undefined,
  after: ProgramReviews | undefined,
) {
  const reviewsBefore = Object.entries(before?.reviews || {}).map(
    ([userId, r]) => ({
      [userId]: {
        rating: r.rating,
        description: r.description,
      },
    }),
  );

  const reviewsAfter = Object.entries(after?.reviews || {}).map(
    ([userId, r]) => ({
      [userId]: {
        rating: r.rating,
        description: r.description,
      },
    }),
  );

  return !isEqual(reviewsBefore, reviewsAfter);
}

function updateProgramRating(db: firestore.Firestore, reviews: ProgramReviews) {
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
