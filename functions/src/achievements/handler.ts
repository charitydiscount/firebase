import { firestore } from 'firebase-admin';
import { pubsub } from 'firebase-functions';
import { handleClick } from './click';
import { AchievementType } from './types';

export const handleAchievementMessage = async (
  message: pubsub.Message,
  db: firestore.Firestore,
) => {
  switch (message.attributes['type']) {
    case AchievementType.CLICK:
      await handleClick(message.json, db, message.attributes['userId']);
      break;
    default:
      break;
  }
};
