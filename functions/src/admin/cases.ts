import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const _db = admin.firestore();

/**
 * Retrieve all stored charity cases
 * @param req Express request
 * @param res Express response
 */
const getCases = (req: Request, res: Response) =>
  _db
    .collection('cases')
    .get()
    .then((querySnap) =>
      res.json(querySnap.docs.map((docSnap) => docSnap.data())),
    );

/**
 * Retrieve a specific charity case
 * @param req Express request with case document ID as param
 * @param res Express response
 */
const getCase = (req: Request, res: Response) =>
  _db
    .collection('cases')
    .doc(req.params.caseId)
    .get()
    .then((caseSnap) => {
      if (!caseSnap.exists) {
        return res.sendStatus(404);
      }

      return res.json(caseSnap.data() || {});
    });

/**
 * Create a new charity case
 * @param req Express request with case in body
 * @param res Express response
 */
const createCase = async (req: Request, res: Response) =>
  _db
    .collection('cases')
    .add(req.body)
    .then((writeResult) => res.json(writeResult.id));

/**
 * Update an existing charity case
 * @param req Express request with case data in body
 *            and case document ID in params
 * @param res Express response
 */
const updateCase = (req: Request, res: Response) =>
  _db
    .collection('cases')
    .doc(req.params.caseId)
    .set(req.body, { merge: true })
    .then(() => res.sendStatus(200));

export default {
  getCases,
  getCase,
  createCase,
  updateCase,
};
