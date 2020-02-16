import { Request, Response } from 'express';
import {
  getTransactionRequests,
  updateTransactionRequest,
  createTransactionRequest,
} from './tx';
import { TxType } from '../tx/types';

/**
 * Retrieve all donations
 * @param req Express request with an optional status in query (accepted, pending or paid)
 * @param res Express response
 */
export const getDonations = (req: Request, res: Response) =>
  getTransactionRequests(res, TxType.DONATION, req.query.status);

/**
 * Retrieve all donations of a specific user
 * @param req Express request with an optional status in query (accepted, pending or paid)
 * @param res Express response
 */
export const getUserDonations = (req: Request, res: Response) =>
  getTransactionRequests(
    res,
    TxType.DONATION,
    req.query.status,
    req.params.userId,
  );

export const updateDonation = (req: Request, res: Response) =>
  updateTransactionRequest(res, req.params.txId, req.body);

export const createDonation = (req: Request, res: Response) =>
  createTransactionRequest(res, req.body);

export default {
  getDonations,
  getUserDonations,
  updateDonation,
  createDonation,
};
