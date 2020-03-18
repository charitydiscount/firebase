import * as admin from 'firebase-admin';
import path = require('path');
import os = require('os');
import fs = require('fs');
import csvParse = require('csv-parser');
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
import moment = require('moment');
import * as entity from '../entities';
import { Commission, toCommissionEntity } from './serializer';
import { getCommissions } from '../two-performant';
import { asyncForEach, isDev } from '../util';
import { BASE_CURRENCY, roundAmount } from '../exchange';
import { config } from 'firebase-functions';

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

  let relevantColumns: { csv: string; target: string }[];
  let linesToSkip = 0;
  let originIdSalt = 0;
  if (source === 'altex') {
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
          if (source === 'altex') {
            programName = 'Altex';
            switch (rawCommission.status) {
              case 'In asteptare':
                commissionStatus = 'pending';
                break;
              case 'Aprobat':
                commissionStatus = 'paid';
                break;
              case 'Anulat':
                commissionStatus = 'rejected';
                break;
              default:
                break;
            }
          }
          const program = programs.find((p) => p.name === programName);

          // Amounts from CSV are always in RON (already converted)
          const originalAmount = Number.parseFloat(rawCommission.amount);
          const originId = !!rawCommission.originId
            ? parseInt(rawCommission.originId)
            : moment(rawCommission.date, 'DD.MM.YYYY').valueOf() + originIdSalt;
          originIdSalt++;
          const commission: entity.Commission = {
            amount: roundAmount(originalAmount * userPercent),
            originalAmount: roundAmount(originalAmount),
            originalCurrency: BASE_CURRENCY,
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
            source: source || '2p',
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
  const commissions: Commission[] = await getCommissions();

  const meta = await db.doc('meta/general').get();
  const userPercent: number = meta.data()!.userPercentage || 0.6;

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
      !currentUserCommissions[commission.id].updatedAt.isEqual(
        //@ts-ignore
        commissionToBeSaved.updatedAt,
      )
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

export default { bucket, updateCommissionFromBucket };
