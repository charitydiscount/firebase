import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import path = require('path');
import os = require('os');
import fs = require('fs');
import csvParse = require('csv-parser');

admin.initializeApp();
const db = admin.firestore();

import { processTx } from './tx';
import { TxStatus, Commission } from './tx/types';
import { updateProgramRating } from './rating';
import { ProgramReviews } from './rating/types';
import { createWallet } from './user';
import { handleNewOtp } from './otp';
import { updateWallet } from './tx/commission';
import * as entity from './entities';
import { Timestamp } from '@google-cloud/firestore';
import { Contact, sendContactMessage } from "./contact";

/**
 * Create the user wallet document when a new user registers
 */
export const handleNewUser = functions
  .region('europe-west1')
  .auth.user()
  .onCreate((user: functions.auth.UserRecord) => {
    const promises = [];
    promises.push(createWallet(db, user));

    return Promise.all(promises).catch((e) => console.log(e.message));
  });

/**
 * Process the donation/cashout request
 */
export const processTransaction = functions
  .region('europe-west1')
  .firestore.document('requests/{requestId}')
  .onCreate(async (snap, context) => {
    const tx = snap.data();
    if (!tx) {
      console.log(`Undefined transaction`);
      return;
    }

    const txResult = await processTx(
      db,
      {
        id: snap.id,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        userId: tx.userId,
        createdAt: tx.createdAt,
        target: tx.target,
      },
      snap.ref,
    );

    if (txResult.status === TxStatus.ACCEPTED) {
      console.log(`Request ${snap.id} processed successfully.`);
    } else {
      console.log(`Request ${snap.id} rejected.`);
    }
  });

/**
 * Update the average rating of a program when a rating is written
 */
export const updateOverallRating = functions
  .region('europe-west1')
  .firestore.document('reviews/{programId}')
  .onWrite((snap, context) => {
    return updateProgramRating(db, snap.after.data() as ProgramReviews);
  });

/**
 * Handle the one-time password requests
 */
export const generateOtp = functions
  .region('europe-west1')
  .firestore.document('otp-requests/{userId}')
  .onWrite(async (snap, context) => {
    const userId = snap.after.id;
    let userRecord;
    try {
      userRecord = await admin.auth().getUser(userId);
    } catch (e) {
      // user doesn't exist
      console.log(`User ${userId} doesn't exist`);
      return;
    }

    // throttle the otp generation (30 seconds)
    const userOtp = await db.doc(`otps/${userId}`).get();
    const now = admin.firestore.Timestamp.now().toMillis();
    const lastGenerated = userOtp.data()!.generatedAt.toMillis();
    if (userOtp.exists && lastGenerated + 30000 > now) {
      console.log(`Request throttled`);
      return;
    }

    return handleNewOtp(db, userRecord);
  });

/**
 * Update the user wallet on commissions update
 */
export const updateUserWallet = functions
  .region('europe-west1')
  .firestore.document('commissions/{userId}')
  .onWrite((snap, context) => {
    if (!snap.after.exists) {
      return;
    }

    const uid = snap.after.id;
    let previousCommissions: Commission[] = [];
    if (snap.before.exists) {
      previousCommissions = getUserCommissions(
        <{
          userId: string,
          [commissionId: number]: Commission
        }>snap.after.data());
    }
    const commissions = getUserCommissions(
      <{
        userId: string,
        [commissionId: number]: Commission
      }>snap.after.data());

    if (!commissions) {
      console.log(`No commissions for user ${uid}`);
      return;
    }

    return updateWallet(db, uid, Object.values(commissions), previousCommissions);
  });

const getUserCommissions = (
  commissions: {
    userId: string,
    [commissionId: number]: Commission
  }) => {
  const { userId, ...commissionsMap } = commissions;
  return Object.values(commissionsMap);
}

const commissionsBucket = 'charitydiscount-commissions';
const bucket = admin.storage().bucket(commissionsBucket);

export const updateCommissionsFromStorage = functions
  .region('europe-west1')
  .storage.bucket(commissionsBucket)
  .object()
  .onFinalize(async (object) => {
    const fileName = object.name || '';
    const tempFilePath = path.join(os.tmpdir(), fileName);
    await bucket.file(fileName).download({ destination: tempFilePath });
    const userCommissions = {} as { [userId: string]: entity.Commission[] };
    const shopsCollection = await db.collection('shops').get();
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
      }
    ];
    try {
      await new Promise((resolve, reject) =>
        fs
          .createReadStream(tempFilePath)
          .pipe(
            csvParse({
              mapHeaders: ({ header }) => {
                const column = relevantColumns.find(
                  (col) => col.csv === header,
                );
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
              amount: Number.parseFloat(rawCommission.amount),
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
              ...{ [commission.originId]: commission }
            }
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
  });

export const sendContactMail = functions
  .region('europe-west1')
  .firestore.document('contact/{randomId}')
  .onCreate((snap, context) => {
    return sendContactMessage(db, snap.id, snap.data() as Contact);
  });
