import { Request, Response } from 'express';
import * as admin from 'firebase-admin';

const _db = admin.firestore();

/**
 * Retrieve all stored messages from contact
 *
 * @param req Express request
 * @param res Express response
 */
const getMessages = (req: Request, res: Response) =>
  _db
    .collection('contact')
    .get()
    .then((querySnap) =>
      res.json(
        querySnap.docs.map((docSnap) => {
          return { ...docSnap.data(), id: docSnap.id };
        }),
      ),
    );

/**
 * Update an existing message
 * @param req Express request with message status in the body
 *            and message ID in params
 * @param res Express response
 */
const updateMessage = (req: Request, res: Response) => {
  if (!req.params.meId || !req.body.status) {
    return res.sendStatus(401);
  }

  return _db
    .collection('contact')
    .doc(req.params.meId)
    .update({
      status: req.body.status,
    })
    .then(() => res.sendStatus(200));
};

export default {
  getMessages,
  updateMessage,
};
