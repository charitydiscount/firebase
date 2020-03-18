import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { checkObjectWithProperties, CheckResult } from '../checks';
import { Commission } from '../entities';
import { BASE_CURRENCY, convertAmount, roundAmount } from '../exchange';
import { TxStatus } from '../tx/types';

const _db = admin.firestore();

/**
 * Retrieve all stored commissions
 * @param req Express request
 * @param res Express response
 */
export const getCommissions = (req: Request, res: Response) =>
  _db
    .collection('commissions')
    .get()
    .then((querySnap) =>
      res.json(querySnap.docs.map((commissionSnap) => commissionSnap.data())),
    );

/**
 * Retrieve commissions of a specific user
 * @param req Express request with userId as param
 * @param res Express response
 */
export const getCommissionsOfUser = (req: Request, res: Response) =>
  _db
    .collection('commissions')
    .doc(req.params.userId)
    .get()
    .then((commissionSnap) => {
      return commissionSnap.exists
        ? res.json(commissionSnap.data())
        : res.sendStatus(404);
    });

/**
 * Create a commission for a given user
 * @param req Express request with commission in body and userId in params
 * @param res Express response
 */
export const createUserCommission = async (req: Request, res: Response) => {
  const validationResult = validateNewCommission(req.body);
  if (!validationResult.isValid) {
    return res.status(422).json(validationResult.violations);
  }

  let user: admin.auth.UserRecord;
  try {
    user = await admin.auth().getUser(req.params.userId);
  } catch (e) {
    return res.status(404).json('User not found');
  }

  const meta = await _db.doc('meta/general').get();
  const userPercent: number = meta.data()!.userPercentage || 0.6;

  let userAmount = req.body.originalAmount * userPercent;
  let currency = req.body.originalCurrency;
  if (currency !== BASE_CURRENCY) {
    const conversionResult = await convertAmount(userAmount, currency);
    userAmount = conversionResult.amount;
    currency = conversionResult.currency;
  }
  const commissionid = req.body.originId || Date.now();
  const newUserCommission: Commission = {
    originalAmount: roundAmount(req.body.originalAmount),
    originalCurrency: req.body.originalCurrency,
    amount: roundAmount(userAmount),
    currency: currency,
    status: req.body.status || TxStatus.PENDING.toLowerCase(),
    originId: commissionid,
    shopId: req.body.shopId,
    program: req.body.program,
    source: req.body.source,
    createdAt: admin.firestore.Timestamp.fromMillis(Date.now()),
    updatedAt: admin.firestore.Timestamp.fromMillis(Date.now()),
  };

  console.log(`New commission: ${newUserCommission.originId}`);

  const saveResult = await _db
    .collection('commissions')
    .doc(user.uid)
    .set(
      {
        [commissionid]: {
          ...newUserCommission,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        userId: user.uid,
      },
      { merge: true },
    );

  console.log(saveResult.writeTime);
  return res.json(saveResult.writeTime);
};

/**
 * Update a commission for a given user
 * @param req Express request with commission in body
 *            and commissionId (originId) and userId in params
 * @param res Express response
 */
export const updateUserCommission = async (req: Request, res: Response) => {
  const validationResult = validateCommission(req.body);
  if (!validationResult.isValid) {
    return res.status(422).json(validationResult.violations);
  }
  let user: admin.auth.UserRecord;
  try {
    user = await admin.auth().getUser(req.params.userId);
  } catch (e) {
    return res.status(404).json('User not found');
  }

  const saveResult = await _db
    .collection('commissions')
    .doc(user.uid)
    .set(
      {
        [req.params.commissionId]: {
          ...req.body,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
  return res.json(saveResult.writeTime);
};

const validateNewCommission = (data: any): CheckResult => {
  const baseFieldsResult = checkObjectWithProperties(data, [
    { key: 'originalAmount', type: 'number' },
    { key: 'originalCurrency', type: 'string' },
    { key: 'shopId', type: 'string' },
    { key: 'program', type: 'object' },
    { key: 'source', type: 'string' },
    { key: 'status', type: 'string', optional: true },
    { key: 'originId', type: 'number', optional: true },
    { key: 'reason', type: 'string', optional: true },
  ]);

  if (!baseFieldsResult.isValid) {
    return baseFieldsResult;
  }

  return checkObjectWithProperties(data['program'], [
    { key: 'name', type: 'string' },
    { key: 'logo', type: 'string' },
    { key: 'slug', type: 'string', optional: true },
    { key: 'paymentType', type: 'string', optional: true },
    { key: 'status', type: 'string', optional: true },
    { key: 'userLogin', type: 'string', optional: true },
  ]);
};

const validateCommission = (data: any): CheckResult => {
  return checkObjectWithProperties(data, [
    { key: 'originalAmount', type: 'number' },
    { key: 'amount', type: 'number' },
    { key: 'originalCurrency', type: 'string' },
    { key: 'currency', type: 'string' },
    { key: 'shopId', type: 'string' },
    { key: 'status', type: 'string', optional: true },
    { key: 'originId', type: 'number' },
    { key: 'reason', type: 'string', optional: true },
    { key: 'program', type: 'object' },
  ]);
};

export default {
  getCommissions,
  getCommissionsOfUser,
  updateUserCommission,
  createUserCommission,
};
