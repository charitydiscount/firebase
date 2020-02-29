import * as admin from 'firebase-admin';
import { TxType, TxRequest, TxStatus } from '../tx/types';
import { Response } from 'express';
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

  const snaps = await query.get();
  const result: any[] = [];
  await asyncForEach(snaps.docs, async (doc) => {
    const txRequestData = doc.data() as TxRequest;
    if (typeof txRequestData.target === 'string') {
      txRequestData.target = {
        id: txRequestData.target,
        name: '',
      };
    }

    result.push({ ...txRequestData, id: doc.id });
  });

  return response.json(result);
};

export const updateTransactionRequest = (
  res: Response,
  txId: string,
  txData: TxRequest,
) => {
  if (!isValidTxStatus(txData.status)) {
    return res.sendStatus(401);
  }

  return _db
    .collection('requests')
    .doc(txId)
    .update({
      status: txData.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => res.sendStatus(200));
};
