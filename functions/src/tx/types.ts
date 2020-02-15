import { firestore } from 'firebase-admin';

export enum TxType {
  DONATION = 'DONATION',
  CASHOUT = 'CASHOUT',
  BONUS = 'BONUS',
  COMMISSION = 'COMMISSION',
}

export enum TxStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
  ERROR = 'ERROR',
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
  target: string;
  status: TxStatus;
}

export interface UserTransaction {
  amount: number;
  currency: string;
  date: firestore.Timestamp | firestore.FieldValue;
  type: TxType;
  sourceTxId: string;
  target: string;
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
}

export interface TxHandler {
  process(source: TxRequest): Promise<ProcessResult>;
}
