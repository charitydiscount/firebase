import * as admin from 'firebase-admin';
import { TxType, TxRequest, TxStatus } from '../tx/types';
import { Response } from 'express';
import { CheckResult, checkObjectWithProperties } from '../checks';

const _db = admin.firestore();

export const isValidTxStatus = (status: String) =>
  !![
    TxStatus.ACCEPTED,
    TxStatus.PENDING,
    TxStatus.REJECTED,
    TxStatus.PAID,
    TxStatus.ERROR,
  ].find((supportedStatus) => supportedStatus === status.toUpperCase());

export const getTransactionRequests = (
  response: Response,
  type: TxType,
  status?: string,
  userId?: string,
) => {
  let query = _db.collection('requests').where('type', '==', type);

  if (status) {
    if (!isValidTxStatus(status)) {
      return response.sendStatus(401);
    }
    query = query.where('status', '==', status.toUpperCase());
  }

  if (userId) {
    query = query.where('userId', '==', userId);
  }

  return query
    .get()
    .then((querySnap) =>
      response.json(querySnap.docs.map((snap) => snap.data())),
    );
};

export const updateTransactionRequest = (
  res: Response,
  txId: string,
  txData: TxRequest,
) => {
  const validationResult = validateTx(txData);
  if (!validationResult.isValid) {
    return res.json(validationResult.violations);
  }

  if (!isValidTxStatus(txData.status)) {
    return res.sendStatus(401);
  }

  return _db
    .collection('requests')
    .doc(txId)
    .update({
      ...txData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => res.sendStatus(200));
};

export const createTransactionRequest = (res: Response, txData: TxRequest) => {
  const validationResult = validateTx(txData);
  if (!validationResult.isValid) {
    return res.json(validationResult.violations);
  }

  if (!isValidTxStatus(txData.status)) {
    return res.sendStatus(401);
  }

  return _db
    .collection('requests')
    .add({
      ...txData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => res.sendStatus(200));
};

const validateTx = (data: any): CheckResult => {
  return checkObjectWithProperties(data, [
    { key: 'amount', type: 'number' },
    { key: 'currency', type: 'string' },
    { key: 'status', type: 'string' },
    { key: 'target', type: 'string' },
    { key: 'type', type: 'string' },
    { key: 'userId', type: 'string' },
  ]);
};
