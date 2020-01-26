import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { checkObjectWithProperties, CheckResult } from '../checks';

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
  const validationResult = validateCommission(req.body);
  if (!validationResult.isValid) {
    return res.json(validationResult.violations);
  }

  const saveResult = await _db
    .collection('commissions')
    .doc(req.params.userId)
    .set(
      {
        [req.body.originId]: {
          ...req.body,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );
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
    return res.json(validationResult.violations);
  }

  const saveResult = await _db
    .collection('commissions')
    .doc(req.params.userId)
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
};
