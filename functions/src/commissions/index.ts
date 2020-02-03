import * as admin from 'firebase-admin';
import path = require('path');
import os = require('os');
import fs = require('fs');
import csvParse = require('csv-parser');
import * as entity from '../entities';
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
import { Commission, toCommissionEntity } from './serializer';
import { getCommissions } from '../two-performant';
import { asyncForEach } from '../util';
import { BASE_CURRENCY } from '../exchange';
import { config } from 'firebase-functions';

const commissionsBucketName = config().platform.commissions_bucket;
const commissionsBucket = admin.storage().bucket(commissionsBucketName);

const updateCommissionFromBucket = async (
  db: admin.firestore.Firestore,
  object: ObjectMetadata,
) => {
  const fileName = object.name || '';
  const tempFilePath = path.join(os.tmpdir(), fileName);
  await commissionsBucket
    .file(fileName)
    .download({ destination: tempFilePath });

  const meta = await db.doc('meta/2performant').get();
  const userPercent: number = meta.data()!.percentage || 0.6;

  // Get the shops in order to retrieve the shop IDs
  const programs: entity.Program[] = [];
  const programsSnap = await db
    .collection('programs')
    .doc('all')
    .get();
  const programsData = <entity.ProgramSnapshot>programsSnap.data();

  for (const uniqueCode in programsData) {
    if (programsData.hasOwnProperty(uniqueCode) && uniqueCode !== 'updatedAt') {
      programs.push(programsData[uniqueCode]);
    }
  }

  const userCommissions = {} as { [userId: string]: entity.Commission[] };

  const relevantColumns = [
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
      csv: 'Status',
      target: 'status',
    },
    {
      csv: 'Transaction Date',
      target: 'createdAt',
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
  try {
    await new Promise((resolve, reject) =>
      fs
        .createReadStream(tempFilePath)
        .pipe(
          csvParse({
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
          const program = programs.find(
            (p) => p.name === rawCommission.programName,
          );

          // Amounts from CSV are always in RON (already converted)
          const originalAmount =
            Number.parseFloat(rawCommission.amount) * userPercent;
          const commission: entity.Commission = {
            amount: originalAmount,
            originalAmount: originalAmount,
            originalCurrency: BASE_CURRENCY,
            currency: BASE_CURRENCY,
            shopId: !!program ? program.id : null,
            status: rawCommission.status,
            originId: parseInt(rawCommission.originId),
            program: {
              name: rawCommission.programName,
              logo: !!program ? program.logoPath : null,
            },
            createdAt: admin.firestore.Timestamp.fromMillis(
              Date.parse(rawCommission.createdAt),
            ),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    return promises;
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
  const commissions: Commission[] = await getCommissions();

  const meta = await db.doc('meta/2performant').get();
  const userPercent: number = meta.data()!.percentage || 0.6;

  const userCommissions: {
    [userId: string]: { [commissionId: number]: entity.Commission };
  } = {};

  const currentCommissions: {
    [userId: string]: { [commissionId: number]: entity.Commission } | null;
  } = {};

  await asyncForEach(commissions, async (commission) => {
    const userIdOfCommission = getUserForCommission(commission);
    const commissionToBeSaved = await toCommissionEntity(
      commission,
      userPercent,
    );

    if (currentCommissions[userIdOfCommission] === undefined) {
      const userCommSnap = await getCurrentUserCommissions(
        db,
        userIdOfCommission,
      );
      if (!userCommSnap.exists) {
        currentCommissions[userIdOfCommission] = null;
      } else {
        const snapData = userCommSnap.data();
        if (snapData) {
          currentCommissions[userIdOfCommission] = snapData;
        } else {
          currentCommissions[userIdOfCommission] = null;
        }
      }
    }

    const currentUserCommissions = currentCommissions[userIdOfCommission];
    if (
      currentUserCommissions === undefined ||
      currentUserCommissions === null ||
      !currentUserCommissions[commission.id] ||
      currentUserCommissions[commission.id].updatedAt !==
        commissionToBeSaved.updatedAt
    ) {
      userCommissions[userIdOfCommission] = {
        ...userCommissions[userIdOfCommission],
        ...{ [commission.id]: commissionToBeSaved },
      };
    }
  });

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

  return promises;
}

const getCurrentUserCommissions = (
  db: admin.firestore.Firestore,
  userId: string,
) =>
  db
    .collection('commissions')
    .doc(userId)
    .get();

function getUserForCommission(commission: Commission) {
  if (!commission.statsTags || commission.statsTags.length === 0) {
    return '';
  }

  return commission.statsTags.slice(1, commission.statsTags.length - 1);
}

export default { commissionsBucketName, updateCommissionFromBucket };
