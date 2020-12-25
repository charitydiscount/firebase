import { Reviewer } from '../rating/review.model';
import { User } from '../user/user.model';

export const userToReviewer = (user: User): Reviewer => ({
  userId: user.userId,
  name: user.privateName ? 'Anonim' : user.name,
  photoUrl: user.privatePhoto ? '' : user.photoUrl,
  privateName: user.privateName || false,
  privatePhoto: user.privatePhoto || false,
});
