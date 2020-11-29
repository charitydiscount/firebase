import { firestore } from 'firebase-admin';
import { FirestoreCollections } from '../collections';
import { Currencies } from '../entities/currencies';
import { NotificationTypes, sendNotification } from '../notifications/fcm';
import { getUserDeviceTokens } from '../notifications/tokens';
import { TxStatus } from '../tx/types';
import { Achievement, AchievementRewardRequest } from './achievement.model';

export const handleRewardRequest = async (
  db: firestore.Firestore,
  requestSnap: firestore.QueryDocumentSnapshot,
) => {
  const request = requestSnap.data() as AchievementRewardRequest;

  const achievementSnap = await db
    .collection(FirestoreCollections.ACHIEVEMENTS)
    .doc(request.achievement.id)
    .get();

  if (!achievementSnap.exists) {
    console.error(`Could not find achievement ${request.achievement.id}`);
    await requestSnap.ref.set(
      {
        status: TxStatus.ERROR,
        reason: 'Reward not defined',
      },
      { merge: true },
    );
    return;
  }
  const reward = (achievementSnap.data() as Achievement).reward;

  await requestSnap.ref.set(
    {
      status: TxStatus.PAID,
    },
    { merge: true },
  );

  switch (reward.currency) {
    case Currencies.CHARITY_POINTS:
      await db
        .collection(FirestoreCollections.WALLETS)
        .doc(request.userId)
        .set(
          {
            'points.approved': firestore.FieldValue.increment(reward.amount),
          },
          { merge: true },
        );
      break;
    default:
      break;
  }

  // Send notification
  const userDevices = await getUserDeviceTokens(db, request.userId);
  if (userDevices && userDevices.length > 0) {
    const title = 'O nouă reușită. Felicitări!🔥';
    const body = `Tocmai ai cucerit provocarea '${request.achievement.name.ro}' și ai fost răsplătit cu ${reward.amount} ${reward.currency}`;
    await sendNotification(
      {
        title,
        body,
        type: NotificationTypes.REWARD,
      },
      userDevices,
    );
  }
};
