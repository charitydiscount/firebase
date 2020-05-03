import * as admin from 'firebase-admin';
import path = require('path');
import os = require('os');
import fs = require('fs');
import csvParse = require('csv-parser');
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
import moment = require('moment');
import * as entity from '../entities';
import {
  Commission,
  toCommissionEntity,
  getUserFor2PCommission,
} from './serializer';
import { getCommissions2P } from '../two-performant';
import { asyncForEach, isDev } from '../util';
import { BASE_CURRENCY, roundAmount } from '../exchange';
import { config } from 'firebase-functions';
import { getAltexCommissionStatus, getAltexCommissions } from '../altex';
import elastic from '../elastic';

const bucket = {
  get name() {
    if (config().platform) {
      return config().platform.commissions_bucket;
    } else {
      return isDev
        ? 'charitydiscount-dev-commissions'
        : 'charitydiscount-commissions';
    }
  },
};

const updateCommissionFromBucket = async (
  db: admin.firestore.Firestore,
  object: ObjectMetadata,
) => {
  if (!object.name) {
    return;
  }
  const fileName = path.basename(object.name);
  const source = path.dirname(object.name);
  const tempFilePath = path.join(os.tmpdir(), fileName);
  const commissionsBucket = admin.storage().bucket(bucket.name);
  await commissionsBucket
    .file(object.name)
    .download({ destination: tempFilePath });

  const meta = await db.doc('meta/general').get();
  const userPercent: number = meta.data()!.userPercentage || 0.6;

  // Get the shops in order to retrieve the shop IDs
  const programs: entity.Program[] = [];
  const programsSnap = await db.collection('programs').doc('all').get();
  const programsData = <entity.ProgramSnapshot>programsSnap.data();

  for (const uniqueCode in programsData) {
    if (programsData.hasOwnProperty(uniqueCode) && uniqueCode !== 'updatedAt') {
      programs.push(programsData[uniqueCode]);
    }
  }

  const userCommissions = {} as { [userId: string]: entity.Commission[] };

  let relevantColumns: { csv: string; target: string }[];
  let linesToSkip = 0;
  let originIdSalt = 0;
  if (source === entity.Source.ALTEX) {
    linesToSkip = 5;
    relevantColumns = [
      {
        csv: 'Comision',
        target: 'amount',
      },
      {
        csv: 'Status',
        target: 'status',
      },
      {
        csv: 'Suma',
        target: 'saleAmount',
      },
      {
        csv: 'Data Comanda',
        target: 'date',
      },
      {
        csv: 'Tag afiliat',
        target: 'userId',
      },
    ];
  } else {
    relevantColumns = [
      {
        csv: 'ID',
        target: 'originId',
      },
      {
        csv: 'Program',
        target: 'programName',
      },
      {
        csv: 'Commission Amount (RON)',
        target: 'amount',
      },
      {
        csv: 'Sale Amount (RON)',
        target: 'saleAmount',
      },
      {
        csv: 'Status',
        target: 'status',
      },
      {
        csv: 'Transaction Date',
        target: 'date',
      },
      {
        csv: 'Click Tag',
        target: 'userId',
      },
      {
        csv: 'Comments',
        target: 'reason',
      },
    ];
  }
  try {
    await new Promise((resolve, reject) =>
      fs
        .createReadStream(tempFilePath)
        .pipe(
          csvParse({
            skipLines: linesToSkip,
            mapHeaders: ({ header }) => {
              const column = relevantColumns.find((col) => col.csv === header);
              if (column === undefined) {
                return null;
              }

              return column.target;
            },
          }),
        )
        .on('data', (data) => {
          const { userId, ...rawCommission } = data;
          if (!userId) {
            return;
          }

          let programName = rawCommission.programName;
          let commissionStatus = rawCommission.status;
          if (source === entity.Source.ALTEX) {
            programName = 'Altex';
            commissionStatus = getAltexCommissionStatus(rawCommission);
          }
          const program = programs.find((p) => p.name === programName);

          // Amounts from CSV are always in RON (already converted)
          const originalAmount = Number.parseFloat(rawCommission.amount);
          const originId = !!rawCommission.originId
            ? parseInt(rawCommission.originId)
            : moment(rawCommission.date, 'DD.MM.YYYY').valueOf() + originIdSalt;
          originIdSalt++;
          const commission: entity.Commission = {
            originalAmount: roundAmount(originalAmount),
            saleAmount: roundAmount(
              Number.parseFloat(rawCommission.saleAmount),
            ),
            originalCurrency: BASE_CURRENCY,
            amount: roundAmount(originalAmount * userPercent),
            currency: BASE_CURRENCY,
            shopId: !!program ? program.id : null,
            status: commissionStatus,
            originId: originId,
            program: {
              name: programName,
              logo: !!program ? program.logoPath : null,
            },
            createdAt: admin.firestore.Timestamp.fromMillis(
              moment(rawCommission.date, 'DD.MM.YYYY').valueOf(),
            ),
            updatedAt: admin.firestore.Timestamp.fromMillis(
              moment(rawCommission.date, 'DD.MM.YYYY').valueOf(),
            ),
            source: source || entity.Source.TWO_PERFORMANT,
          };
          if (rawCommission.reason && Array.isArray(rawCommission.reason)) {
            commission.reason = rawCommission.reason.join(' ');
          }
          userCommissions[userId] = {
            ...userCommissions[userId],
            ...{ [commission.originId]: commission },
          };
        })
        .on('end', () => {
          resolve(userCommissions);
        })
        .on('error', (error) => reject(error)),
    );
    fs.unlinkSync(tempFilePath);
    const promises: Promise<any>[] = [];
    for (const userId in userCommissions) {
      promises.push(
        db
          .collection('commissions')
          .doc(userId)
          .set(
            {
              userId,
              ...userCommissions[userId],
            },
            { merge: true },
          ),
      );
    }
    return Promise.all(promises);
  } catch (e) {
    console.log(e);
    fs.unlinkSync(tempFilePath);
    return;
  }
};

/**
 * Update the commissions
 * @param commissions
 */
export async function updateCommissions(db: admin.firestore.Firestore) {
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

  const commissionsArray = entity.userCommissionsToArray(newCommissions);
  if (commissionsArray.length > 0) {
    console.log(commissionsArray[0]);
    elastic
      .sendBulkRequest(elastic.buildBulkBodyForCommissions(commissionsArray))
      .catch((e) => console.log(e.message));
  }

  return promises;
}

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
    )
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
    metaData.commissionsTwoPSince
      ? metaData.commissionsTwoPSince.toDate()
      : undefined,
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
    const userIdOfCommission = getUserFor2PCommission(commission);
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

export default { bucket, updateCommissionFromBucket };
