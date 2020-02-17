import { Request, Response } from 'express';
import { getTransactionRequests, updateTransactionRequest } from './tx';
import { TxType } from '../tx/types';

/**
 * Retrieve all withdrawals
 * @param req Express request with an optional status in query (accepted, pending or paid)
 * @param res Express response
 */
export const getWithdrawals = (req: Request, res: Response) =>
  getTransactionRequests(res, TxType.CASHOUT, req.query.status);

/**
 * Retrieve all withdrawals of a specific user
 * @param req Express request with an optional status in query (accepted, pending or paid)
 * @param res Express response
 */
export const getUserWithdrawals = (req: Request, res: Response) =>
  getTransactionRequests(
    res,
    TxType.CASHOUT,
    req.query.status,
    req.params.userId,
  );

export const updateWithdrawal = (req: Request, res: Response) =>
  updateTransactionRequest(res, req.params.txId, req.body);

export default {
  getWithdrawals,
  getUserWithdrawals,
  updateWithdrawal,
};
