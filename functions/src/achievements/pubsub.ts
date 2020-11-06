import { PubSub } from '@google-cloud/pubsub';
import { AchievementType } from './types';

let pubsub: PubSub;

export const publishMessage = async (
  type: AchievementType,
  data: any,
  userId: string,
) => {
  if (!pubsub) {
    pubsub = new PubSub();
  }

  try {
    await pubsub.topic('achievements').publishMessage({
      attributes: { type, userId },
      json: { data },
    });
  } catch (error) {
    console.error(`Couldn't publish message: ${error.message || error}`);
  }
};
