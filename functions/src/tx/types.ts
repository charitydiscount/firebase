import { firestore } from 'firebase-admin';

export enum TxType {
  DONATION = 'DONATION',
  CASHOUT = 'CASHOUT',
  BONUS = 'BONUS',
  COMMISSION = 'COMMISSION',
  REFERRAL = 'REFERRAL',
}

export enum TxStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
  PAID = 'PAID',
}

export interface ProcessResult {
  status: TxStatus;
}

export interface TxRequest {
  id: string;
  type: TxType;
  amount: number;
  currency: string;
  userId: string;
  createdAt: firestore.Timestamp;
  target: TxTarget;
  status: TxStatus;
}

export interface TxTarget {
  id: string;
  name: string;
}

export interface UserTransaction {
  amount: number;
  currency: string;
  date: firestore.Timestamp | firestore.FieldValue;
  type: TxType;
  sourceTxId: string;
  target: TxTarget;
  userId: string;
}

export interface Commission {
  amount: number;
  createdAt: firestore.Timestamp;
  currency: string;
  originId: number;
  shopId: number;
  status: string;
}

export interface UserWallet {
  cashback: {
    approved: number;
    pending: number;
  };
  points: {
    approved: number;
  };
  transactions: UserTransaction[];
  userId: string;
}

export interface TxHandler {
  process(source: TxRequest): Promise<ProcessResult>;
}
