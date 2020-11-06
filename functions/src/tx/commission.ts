import { UserTransaction, TxType, UserWallet } from './types';
import { firestore } from 'firebase-admin';
import { asyncForEach, sendNotification } from '../util';
import { Commission, Source } from '../entities';
import { createWallet } from '../user';

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
  let unprocessedAcceptedCommissions = newCommissions.filter(
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
    console.log(`Wallet of user ${userId} doesn't exist. Initializing it`);
    await createWallet(db, userId);
  }

  // Filter out commissions that are already stored in the transactions array
  const currentUserTransactions = (userWallet.data() as UserWallet)
    .transactions;
  unprocessedAcceptedCommissions = unprocessedAcceptedCommissions.filter(
    (c) =>
      currentUserTransactions.find(
        (tx) =>
          tx.type === TxType.COMMISSION &&
          tx.sourceTxId === c.originId.toString(),
      ) !== undefined,
  );

  const newPendingCommissions = newCommissions.filter(
    (commission) =>
      pendingStatuses.includes(commission.status) &&
      previousCommissions.find(
        (prev) => prev.originId === commission.originId,
      ) === undefined,
  );

  if (
    unprocessedAcceptedCommissions.length === 0 &&
    newPendingCommissions.length === 0
  ) {
    // No new commissions
    return;
  }

  let userDevices: string[];
  await asyncForEach(newPendingCommissions, async (commission: Commission) => {
    if (userDevices === undefined) {
      userDevices = await getUserDeviceTokens(db, userId);
    }
    if (userDevices && userDevices.length > 0) {
      const title =
        commission.source === Source.REFERRAL
          ? 'Un nou bonus a fost înregistrat💸'
          : 'Cumpărătură înregistrată!🛒';
      const body =
        commission.source === Source.REFERRAL
          ? 'Invitatul tău tocmai a cumpărat prin CharityDiscount, adică un nou bonus pentru tine'
          : `Cashback-ul in valoare de ${commission.amount}${commission.currency} este în așteptare`;
      await sendNotification(
        {
          title,
          body,
          type: TxType.COMMISSION,
        },
        userDevices,
      );
    }
  });

  await asyncForEach(
    unprocessedAcceptedCommissions,
    async (commission: Commission) => {
      if (userDevices === undefined) {
        userDevices = await getUserDeviceTokens(db, userId);
      }
      if (userDevices && userDevices.length > 0) {
        const title =
          commission.source === Source.REFERRAL
            ? 'Cashback bonus primit💸'
            : 'Cashback primit!💰';
        const body =
          commission.source === Source.REFERRAL
            ? `${commission.amount}${commission.currency} bonus au fost adăugați portofelului tău`
            : `${commission.amount}${commission.currency} au fost adăugați portofelului tău`;
        await sendNotification(
          {
            title,
            body,
            type: TxType.COMMISSION,
          },
          userDevices,
        );
      }
    },
  );

  await saveTransactionsToWallet(
    userId,
    userWalletRef,
    pendingAmount,
    unprocessedAcceptedCommissions,
  );
};

const getTxFromCommissions = (
  unprocessedCommissions: Commission[],
  userId: string,
): UserTransaction[] => {
  return unprocessedCommissions.map((comm) => {
    let txType: TxType;
    if (comm.source === Source.REFERRAL) {
      txType = TxType.REFERRAL;
    } else {
      txType = TxType.COMMISSION;
    }
    return <UserTransaction>{
      amount: comm.amount,
      currency: comm.currency,
      date: comm.createdAt,
      sourceTxId: comm.originId.toString(),
      target: {
        id: userId,
        name: comm.shopId ? comm.shopId.toString() : comm.program.name,
      },
      type: txType,
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

const saveTransactionsToWallet = (
  userId: string,
  walletRef: firestore.DocumentReference,
  totalPendingAmount: number,
  newPaidCommissions: Commission[],
) => {
  if (newPaidCommissions && newPaidCommissions.length > 0) {
    const newTransactions = getTxFromCommissions(newPaidCommissions, userId);
    const incommingAcceptedAmount = newPaidCommissions
      .map((commission) => commission.amount)
      .reduce((a1, a2) => a1 + a2, 0);

    return walletRef.update({
      'cashback.pending': totalPendingAmount,
      'cashback.approved': firestore.FieldValue.increment(
        incommingAcceptedAmount,
      ),
      'transactions': firestore.FieldValue.arrayUnion(...newTransactions),
    });
  } else {
    return walletRef.update({
      'cashback.pending': totalPendingAmount,
    });
  }
};
