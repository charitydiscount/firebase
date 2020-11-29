import { publishMessage } from '../achievements/pubsub';
import { AchievementType } from '../achievements/types';
import { Click } from '../entities';

export const handleClick = async (click: Click) => {
  await publishMessage(AchievementType.CLICK, click, click.userId);
};
