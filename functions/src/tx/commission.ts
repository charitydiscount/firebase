import { Commission, UserTransaction, TxType } from './types';
import { Firestore, FieldValue } from '@google-cloud/firestore';
import { messaging } from 'firebase-admin';

const fcm = messaging();

/**
 * Update the cashback of the user based on the change in commissions
 * @param db Firestore reference
 * @param userId The user UID for which the commissions are being processed
 * @param newCommissions The new state of the commissions
 * @param previousCommissions The previous state of the commissions
 */
export const updateWallet = async (
  db: Firestore,
  userId: string,
  newCommissions: Commission[],
  previousCommissions: Commission[],
) => {
  const acceptedStatuses = ['paid'];
  const pendingStatuses = ['pending', 'accepted'];
  const unprocessedAcceptedCommissions = newCommissions.filter(
    (commission) =>
      acceptedStatuses.includes(commission.status) &&
      (previousCommissions.find(
        (prev) => prev.originId === commission.originId,
      ) === undefined ||
        !!previousCommissions.find(
          (prev) =>
            prev.originId === commission.originId &&
            pendingStatuses.includes(prev.status),
        )),
  );

  const pendingAmount = newCommissions
    .filter((commission) => pendingStatuses.includes(commission.status))
    .map((commission) => commission.amount)
    .reduce((a1, a2) => a1 + a2, 0);

  const userWalletRef = db.collection('points').doc(userId);
  const userTokenDocs = await db
    .collection('users')
    .doc(userId)
    .collection('tokens')
    .listDocuments();
  const userDevices: string[] = [];
  for await (const tokenRef of userTokenDocs.map((doc) => doc.get())) {
    const device = tokenRef.data();
    if (device!.notifications === undefined || device!.notifications) {
      userDevices.push(device!.token);
    }
  }

  const newPendingCommissions = newCommissions.filter(
    (commission) =>
      pendingStatuses.includes(commission.status) &&
      previousCommissions.find(
        (prev) => prev.originId === commission.originId,
      ) === undefined,
  );
  newPendingCommissions.forEach((commission) => {
    const notification: messaging.MessagingPayload = {
      notification: {
        title: 'Purchase Registered! 🔥',
        body: `${commission.amount} ${commission.currency} should be added soon to your account`,
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    userDevices.forEach((deviceToken) =>
      fcm.sendToDevice(deviceToken, notification),
    );
  });

  if (unprocessedAcceptedCommissions.length > 0) {
    unprocessedAcceptedCommissions.forEach((commission) => {
      const notification: messaging.MessagingPayload = {
        notification: {
          title: 'Cashback Approved! 💰',
          body: `${commission.amount} ${commission.currency} was just added to your wallet`,
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      };

      userDevices.forEach((deviceToken) =>
        fcm.sendToDevice(deviceToken, notification),
      );
    });

    const newTransactions = getTxFromCommissions(
      unprocessedAcceptedCommissions,
      userId,
    );
    const incommingAcceptedAmount = unprocessedAcceptedCommissions
      .map((commission) => commission.amount)
      .reduce((a1, a2) => a1 + a2, 0);

    return userWalletRef.update({
      'cashback.pending': pendingAmount,
      'cashback.approved': FieldValue.increment(incommingAcceptedAmount),
      'transactions': FieldValue.arrayUnion(...newTransactions),
    });
  } else {
    return userWalletRef.update({
      'cashback.pending': pendingAmount,
    });
  }
};

const getTxFromCommissions = (
  unprocessedCommissions: Commission[],
  userId: string,
): UserTransaction[] => {
  return unprocessedCommissions.map((comm) => {
    return <UserTransaction>{
      amount: comm.amount,
      currency: comm.currency,
      date: comm.createdAt,
      sourceTxId: comm.originId.toString(),
      target: userId,
      type: TxType.COMMISSION,
    };
  });
};