import * as entity from '../entities';
import elastic from '../elastic';
import { getCommissionsFromAllPlatforms } from './retrievers';

/**
 * Update the commissions
 * @param commissions
 */
export const updateCommissions = async (db: FirebaseFirestore.Firestore) => {
  const meta = await db.doc('meta/general').get();
  const metaData = meta.data() as entity.MetaGeneral;

  const userPercent = metaData.userPercentage || 0.6;
  const referralPercentage = metaData.referralPercentage || 0.1;

  const newCommissions = await getCommissionsFromAllPlatforms(db, userPercent);

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

  return saveCommissions(usersCommissions, db);
};

const getCurrentUserCommissions = async (
  db: FirebaseFirestore.Firestore,
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

function saveCommissions(
  usersCommissions: entity.UserCommissions,
  db: FirebaseFirestore.Firestore,
) {
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
}
