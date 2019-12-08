import * as admin from 'firebase-admin';
import path = require('path');
import os = require('os');
import fs = require('fs');
import csvParse = require('csv-parser');
import * as entity from '../entities';
import { ObjectMetadata } from 'firebase-functions/lib/providers/storage';
import { Firestore, Timestamp } from '@google-cloud/firestore';

const commissionsBucketName = 'charitydiscount-commissions';
const commissionsBucket = admin.storage().bucket(commissionsBucketName);

const updateCommissionFromBucket = async (
  db: Firestore,
  object: ObjectMetadata,
) => {
  const fileName = object.name || '';
  const tempFilePath = path.join(os.tmpdir(), fileName);
  await commissionsBucket
    .file(fileName)
    .download({ destination: tempFilePath });
  const userCommissions = {} as { [userId: string]: entity.Commission[] };
  const shopsCollection = await db.collection('shops').get();
  const meta = await db.doc('meta/2performant').get();
  const userPercent: number = meta.data()!.percentage || 0.6;
  const programs: entity.Program[] = [];
  shopsCollection.docs.forEach((doc) => programs.push(...doc.data().batch));
  const relevantColumns = [
    {
      csv: 'ID',
      target: 'originId',
    },
    {
      csv: 'Program',
      target: 'shopId',
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
            mapValues: ({ header, index, value }) => {
              if (header !== 'shopId') {
                return value;
              }
              const program = programs.find((p) => p.name === value);
              return !!program ? program.id : value;
            },
          }),
        )
        .on('data', (data) => {
          const { userId, ...rawCommission } = data;
          const commission: entity.Commission = {
            amount: Number.parseFloat(rawCommission.amount) * userPercent,
            createdAt: Timestamp.fromMillis(
              Date.parse(rawCommission.createdAt),
            ),
            currency: 'RON',
            shopId: rawCommission.shopId,
            status: rawCommission.status,
            originId: parseInt(rawCommission.originId),
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

export default { commissionsBucketName, updateCommissionFromBucket };
