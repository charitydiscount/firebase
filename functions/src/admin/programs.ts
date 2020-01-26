import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import uuid = require('uuid/v4');

const _db = admin.firestore();

/**
 * Retrieve all stored programs
 * @param req Express request
 * @param res Express response
 */
const getPrograms = (req: Request, res: Response) =>
  _db
    .collection('programs')
    .doc('all')
    .get()
    .then((programsSnap) => res.json(programsSnap.data()));

/**
 * Retrieve a specific program
 * @param req Express request with programUniqueCode as param
 * @param res Express response
 */
const getProgram = (req: Request, res: Response) =>
  _db
    .collection('programs')
    .doc('all')
    .get()
    .then((programsSnap) => {
      const data = programsSnap.data() || {};
      return data.containsKey(req.params.programUniqueCode)
        ? res.json(data[req.params.programUniqueCode])
        : res.sendStatus(404);
    });

/**
 * Create a new program
 * (the program will have the same UUID used for uniqueCode and ID)
 * @param req Express request with program in body
 * @param res Express response
 */
const createProgram = async (req: Request, res: Response) => {
  const programId = uuid();
  await _db
    .collection('programs')
    .doc('all')
    .set(
      {
        [programId]: { ...req.body, uniqueCode: programId, id: programId },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return res.json({ uniqueCode: programId });
};

/**
 * Update an existing program
 * @param req Express request with program in body
 *            and program unique code in params
 * @param res Express response
 */
const updateProgram = (req: Request, res: Response) =>
  _db
    .collection('programs')
    .doc('all')
    .set(
      {
        [req.params.programUniqueCode]: req.body,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .then(() => res.sendStatus(200));

export default {
  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
};
