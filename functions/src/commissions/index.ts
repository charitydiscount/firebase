import * as admin from 'firebase-admin';
import * as entity from '../entities';
import {
  Commission,
  toCommissionEntity,
  getUserFor2PCommission,
} from './serializer';
import { getCommissions2P } from '../two-performant';
import { asyncForEach } from '../util';
import { getAltexCommissions } from '../altex';
import elastic from '../elastic';

/**
 * Update the commissions
 * @param commissions
 */
export const updateCommissions = async (db: admin.firestore.Firestore) => {
  const meta = await db.doc('meta/general').get();
  const metaData = meta.data() as entity.MetaGeneral;

  const userPercent = metaData.userPercentage || 0.6;
  const referralPercentage = metaData.referralPercentage || 0.1;

  const newCommissions = await get2PCommissions(userPercent, db);
  try {
    const commissionsAltex = await getAltexCommissions(userPercent);

    // Merge commissions
    for (const userId in commissionsAltex) {
      newCommissions[userId] = {
        ...newCommissions[userId],
        ...commissionsAltex[userId],
      };
    }
  } catch (e) {
    console.log(e);
  }

  const usersCommissions: entity.UserCommissions = {};
  const currentCommissions: CurrentCommissions = {};

  // Prepare the new/updated commissions in the internal format
  for (const userId in newCommissions) {
    for (const commissionId in newCommissions[userId]) {
      const commissionToBeSaved = newCommissions[userId][commissionId];
      if (!userId) {
        console.log(
          `Missing userId for commissions: ${commissionToBeSaved.originId}`,
        );

        // TODO Find compensation strategies
        continue;
      }
      if (currentCommissions[userId] === undefined) {
        currentCommissions[userId] = await getCurrentUserCommissions(
          db,
          userId,
        );
      }

      if (
        shouldUpdateCommission(currentCommissions[userId], commissionToBeSaved)
      ) {
        usersCommissions[userId] = {
          ...usersCommissions[userId],
          ...{ [commissionToBeSaved.originId]: commissionToBeSaved },
        };
      }
    }
  }

  // Create commissions for referrals if any
  for (const userId in usersCommissions) {
    // Look for the user who referred the current user
    const referrals = await db
      .collection('referrals')
      .where('userId', '==', userId)
      .get();

    if (referrals.empty) {
      // the current user was not invited by anyone
      continue;
    }
    const referredCommissions = usersCommissions[userId];
    const referral = referrals.docs[0].data() as entity.Referral;
    for (const commissionid in referredCommissions) {
      if (referredCommissions[commissionid].source === entity.Source.REFERRAL) {
        // Source commission is a referral bonus
        continue;
      }
      // Create the resulting referral commission
      const referralCommission = generateReferralCommission(
        referredCommissions[commissionid],
        referralPercentage,
        referral.userId,
      );

      usersCommissions[referral.ownerId] = {
        ...usersCommissions[referral.ownerId],
        ...{ [referralCommission.originId]: referralCommission },
      };
    }
  }

  // Save the commissions
  const promises: Promise<any>[] = [];
  for (const userId in usersCommissions) {
    promises.push(
      db
        .collection('commissions')
        .doc(userId)
        .set(
          {
            userId,
            ...usersCommissions[userId],
          },
          { merge: true },
        ),
    );
  }

  const commissionsArray = entity.userCommissionsToArray(usersCommissions);
  if (commissionsArray.length > 0) {
    elastic
      .sendBulkRequest(elastic.buildBulkBodyForCommissions(commissionsArray))
      .catch((e) => console.log(e.message));
  }

  return promises;
};

const getCurrentUserCommissions = async (
  db: admin.firestore.Firestore,
  userId: string,
): Promise<entity.CommissionEntry | null> => {
  const userCommSnap = await db.collection('commissions').doc(userId).get();
  if (!userCommSnap.exists) {
    return null;
  } else {
    const snapData = userCommSnap.data();
    if (snapData) {
      return snapData as entity.CommissionEntry;
    } else {
      return null;
    }
  }
};

const shouldUpdateCommission = (
  currentUserCommissions: { [commissionId: number]: entity.Commission } | null,
  commissionToBeSaved: entity.Commission,
) => {
  return (
    currentUserCommissions === undefined ||
    currentUserCommissions === null ||
    !currentUserCommissions[commissionToBeSaved.originId] ||
    !currentUserCommissions[commissionToBeSaved.originId].updatedAt.isEqual(
      //@ts-ignore
      commissionToBeSaved.updatedAt,
    ) ||
    currentUserCommissions[commissionToBeSaved.originId].status !==
      commissionToBeSaved.status
  );
};

const get2PCommissions = async (
  userPercent: number,
  db: admin.firestore.Firestore,
) => {
  const commissions: {
    [userId: string]: { [commissionId: number]: entity.Commission };
  } = {};

  const meta = await db.doc('meta/2performant').get();
  const metaData = meta.data() as entity.MetaTwoPerformant;

  const commissions2p: Commission[] = await getCommissions2P(
    metaData.commissionsTwoPSince?.toDate(),
  );

  // Update the since date for 2p
  const oldestPendingComm = commissions2p
    .reverse()
    .find((c2p) => c2p.status === 'pending' || c2p.status === 'accepted');
  if (oldestPendingComm) {
    await meta.ref.update(<entity.MetaTwoPerformant>{
      commissionsTwoPSince: admin.firestore.Timestamp.fromMillis(
        Date.parse(oldestPendingComm.createdAt),
      ),
    });
  }

  await asyncForEach(commissions2p, async (commission) => {
    let userIdOfCommission = getUserFor2PCommission(commission);

    if (!userIdOfCommission) {
      if (commission.publicActionData.sourceIp) {
        // Search based on the click and IP address
        const clicksWithSameIpSnap = await db
          .collection('clicks')
          .where('ipAddress', '==', commission.publicActionData.sourceIp)
          .where('programId', '==', commission.programId.toString())
          .get();
        if (clicksWithSameIpSnap.size === 1) {
          userIdOfCommission = clicksWithSameIpSnap.docs[0].data().userId;
        } else if (clicksWithSameIpSnap.size > 1) {
          console.log(`Multiple clicks found for commission ${commission.id}`);
        }
      }

      if (!userIdOfCommission) {
        // Failed to find the userId
        // Save the commission to the DLQ and hope someone contacts us :D
        // In case someone does, we should add the click entry for now
        // and let the system handle the commission updates
        await db
          .collection('incomplete-commissions')
          .doc(commission.id.toString())
          .set(commission, { merge: true });
        return;
      }
    }

    const commissionToBeSaved = await toCommissionEntity(
      commission,
      userPercent,
    );

    commissions[userIdOfCommission] = {
      ...commissions[userIdOfCommission],
      [commissionToBeSaved.originId]: commissionToBeSaved,
    };
  });

  return commissions;
};

interface CurrentCommissions {
  [userId: string]: entity.CommissionEntry | null;
}

export const generateReferralCommission = (
  originalCommission: entity.Commission,
  referralPercentage: number,
  referralId: string,
): entity.Commission => {
  return {
    ...originalCommission,
    referralId: referralId,
    amount: originalCommission.amount * referralPercentage,
    source: entity.Source.REFERRAL,
  };
};
