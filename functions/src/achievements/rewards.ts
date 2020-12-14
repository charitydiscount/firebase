import { firestore } from 'firebase-admin';
import { Collections } from '../collections';
import { Currency } from '../entities/currencies';
import { NotificationTypes, sendNotification } from '../notifications/fcm';
import { getUserDeviceTokens } from '../notifications/tokens';
import { TxStatus, TxType, UserTransaction } from '../tx/types';
import { Achievement, AchievementRewardRequest } from './achievement.model';

export const handleRewardRequest = async (
  db: firestore.Firestore,
  requestSnap: firestore.QueryDocumentSnapshot,
) => {
  const request = requestSnap.data() as AchievementRewardRequest;

  const achievementSnap = await db
    .collection(Collections.ACHIEVEMENTS)
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

  switch (reward.unit) {
    case Currency.CHARITY_POINTS:
      const userTxBonus: UserTransaction = {
        amount: reward.amount,
        currency: Currency.CHARITY_POINTS,
        date: request.createdAt,
        type: TxType.BONUS,
        sourceTxId: requestSnap.id,
        target: { id: request.userId, name: '' },
        userId: request.userId,
      };
      await db
        .collection(Collections.WALLETS)
        .doc(request.userId)
        .set(
          {
            'points.approved': firestore.FieldValue.increment(reward.amount),
            'transactions': firestore.FieldValue.arrayUnion(userTxBonus),
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
    const body = `Tocmai ai cucerit provocarea '${request.achievement.name.ro}' și ai fost răsplătit cu ${reward.amount} ${reward.unit}`;
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
