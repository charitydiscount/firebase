import { Commission, UserTransaction, TxType } from './types';
import { firestore } from 'firebase-admin';
import { asyncForEach, sendNotification } from '../util';

/**
 * Update the cashback of the user based on the change in commissions
 * @param db Firestore reference
 * @param userId The user UID for which the commissions are being processed
 * @param newCommissions The new state of the commissions
 * @param previousCommissions The previous state of the commissions
 */
export const updateWallet = async (
  db: firestore.Firestore,
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
  const userWallet = await userWalletRef.get();
  if (!userWallet.exists) {
    console.log(`Wallet of user ${userId} doesn't exist. Probably new user`);
    return;
  }

  const newPendingCommissions = newCommissions.filter(
    (commission) =>
      pendingStatuses.includes(commission.status) &&
      previousCommissions.find(
        (prev) => prev.originId === commission.originId,
      ) === undefined,
  );

  const userDevices: string[] = await getUserDeviceTokens(db, userId);
  if (userDevices.length > 0) {
    await asyncForEach(
      newPendingCommissions,
      async (commission: Commission) => {
        await sendNotification(
          {
            title: 'Felicitări!🛒',
            body: `Cashback-ul in valoare de ${commission.amount}${commission.currency} este în așteptare`,
            type: 'COMMISSION',
          },
          userDevices,
        );
      },
    );
  }

  if (unprocessedAcceptedCommissions.length > 0) {
    if (userDevices.length > 0) {
      await asyncForEach(
        unprocessedAcceptedCommissions,
        async (commission: Commission) => {
          await sendNotification(
            {
              title: 'Cashback primit!💰',
              body: `${commission.amount}${commission.currency} au fost adăugați portofelului tău`,
              type: 'COMMISSION',
            },
            userDevices,
          );
        },
      );
    }

    const newTransactions = getTxFromCommissions(
      unprocessedAcceptedCommissions,
      userId,
    );
    const incommingAcceptedAmount = unprocessedAcceptedCommissions
      .map((commission) => commission.amount)
      .reduce((a1, a2) => a1 + a2, 0);

    return userWalletRef.update({
      'cashback.pending': pendingAmount,
      'cashback.approved': firestore.FieldValue.increment(
        incommingAcceptedAmount,
      ),
      'transactions': firestore.FieldValue.arrayUnion(...newTransactions),
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
      target: { id: userId, name: comm.shopId.toString() },
      type: TxType.COMMISSION,
      userId: userId,
    };
  });
};

const getUserDeviceTokens = async (db: firestore.Firestore, userId: string) => {
  const userTokenDocs = await db
    .collection('users')
    .doc(userId)
    .collection('tokens')
    .listDocuments();
  const userDevices: string[] = [];
  await asyncForEach(userTokenDocs, async (tokenDoc) => {
    const tokenSnap = await tokenDoc.get();
    const device = tokenSnap.data();
    if (
      device &&
      (device.notifications === undefined || device.notifications) &&
      device.token
    ) {
      userDevices.push(device.token);
    }
  });

  return userDevices;
};
