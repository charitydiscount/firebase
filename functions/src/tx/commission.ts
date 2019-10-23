import { Commission, UserTransaction, TxType } from './types';
import { Firestore, FieldValue } from '@google-cloud/firestore';

/**
 * Update the cashback of the user based on the change in commissions
 * @param db Firestore reference
 * @param userId The user UID for which the commissions are being processed
 * @param newCommissions The new state of the commissions
 * @param previousCommissions The previous state of the commissions
 */
export const updateWallet = (
  db: Firestore,
  userId: string,
  newCommissions: Commission[],
  previousCommissions: Commission[]) => {
  const acceptedStatuses = ['accepted', 'paid'];
  const unprocessedAcceptedCommissions = newCommissions
    .filter((commission) => acceptedStatuses.includes(commission.status) &&
      (previousCommissions.find((prev) =>
        prev.originId === commission.originId) === undefined ||
        !!previousCommissions.find((prev) =>
          prev.originId === commission.originId &&
          prev.status === 'pending')));

  const pendingAmount = newCommissions
    .filter((commission) => commission.status === 'pending')
    .map((commission) => commission.amount)
    .reduce((a1, a2) => a1 + a2, 0);

  const userWalletRef = db.collection('points').doc(userId);

  if (unprocessedAcceptedCommissions.length > 0) {
    const newTransactions = getTxFromCommissions(unprocessedAcceptedCommissions, userId);
    const incommingAcceptedAmount = unprocessedAcceptedCommissions
      .map((commission) => commission.amount)
      .reduce((a1, a2) => a1 + a2, 0);

    return userWalletRef.update({
      'cashback.pending': pendingAmount,
      'cashback.approved': FieldValue.increment(incommingAcceptedAmount),
      'transactions': FieldValue.arrayUnion(...newTransactions)
    });
  } else {
    return userWalletRef.update({
      'cashback.pending': pendingAmount,
    });
  }
}

const getTxFromCommissions = (
  unprocessedCommissions: Commission[],
  userId: string): UserTransaction[] => {
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
