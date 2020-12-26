import { firestore } from 'firebase-admin';
import { Collections } from '../collections';
import { Commission, CommissionEntry } from '../entities';
import { UserWallet } from '../tx/types';

export interface MissingUserCommissions {
  [userId: string]: Commission[];
}

export const getWalletsWithMissingCommissions = async (
  db: firestore.Firestore,
): Promise<MissingUserCommissions> => {
  const commissionsQuerySnap = await db
    .collection(Collections.COMMISSIONS)
    .get();

  const missingCommissions: MissingUserCommissions = {};
  for (const commissionSnap of commissionsQuerySnap.docs) {
    const userId = commissionSnap.id;
    const userCommissions = commissionSnap.data() as CommissionEntry;

    const walletSnap = await db
      .collection(Collections.WALLETS)
      .doc(userId)
      .get();
    const wallet = walletSnap.data() as UserWallet;

    for (const commissionId in userCommissions) {
      if (commissionId === 'userId') {
        continue;
      }

      const commission = userCommissions[commissionId];
      if (isPaid(commission) && !hasCommission(wallet, commission)) {
        console.log(`Found missing commission ${commission.originId}`);
        pushCommission(missingCommissions, userId, commission);
      }
    }
  }

  return missingCommissions;
};

const hasCommission = (wallet: UserWallet, commission: Commission) =>
  wallet.transactions.find(
    (tx) => tx.sourceTxId === commission.originId.toString(),
  ) !== undefined;

const isPaid = (commission: Commission) => commission.status === 'paid';

function pushCommission(
  missingCommissions: MissingUserCommissions,
  userId: string,
  commission: Commission,
) {
  (missingCommissions[userId] || (missingCommissions[userId] = [])).push(
    commission,
  );
}
