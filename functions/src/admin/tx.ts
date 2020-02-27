import * as admin from 'firebase-admin';
import { TxType, TxRequest, TxStatus } from '../tx/types';
import { Response } from 'express';
import { CheckResult, checkObjectWithProperties } from '../checks';
import { UserAccount } from '../entities';
import { asyncForEach } from '../util';

const _db = admin.firestore();

export const isValidTxStatus = (status: String) =>
  !![
    TxStatus.ACCEPTED,
    TxStatus.PENDING,
    TxStatus.REJECTED,
    TxStatus.PAID,
    TxStatus.ERROR,
  ].find((supportedStatus) => supportedStatus === status.toUpperCase());

export const getTransactionRequests = async (
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

  const userAccounts: { [userId: string]: UserAccount[] } = {};

  const snaps = await query.get();
  const result: any[] = [];
  await asyncForEach(snaps.docs, async (doc) => {
    const txRequestData = doc.data() as TxRequest;
    if (txRequestData.type === TxType.CASHOUT) {
      if (!userAccounts[txRequestData.userId]) {
        // Cache the user bank accounts
        const accountsRef = await _db
          .collection('users')
          .doc(txRequestData.userId)
          .collection('accounts')
          .get();
        userAccounts[txRequestData.userId] = accountsRef.docs.map(
          (accountDoc) => accountDoc.data() as UserAccount,
        );
      }

      if (txRequestData.target === txRequestData.userId) {
        result.push({
          ...txRequestData,
          id: doc.id,
          account: userAccounts[txRequestData.userId][0],
        });
      } else {
        result.push({
          ...txRequestData,
          id: doc.id,
          account: userAccounts[txRequestData.userId].find(
            (account) => account.iban === txRequestData.target,
          ),
        });
      }
    } else {
      result.push({ ...txRequestData, id: doc.id });
    }
  });

  return response.json(result);
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
