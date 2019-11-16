import { Timestamp, FieldValue } from '@google-cloud/firestore';

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
  createdAt: Timestamp;
  target: string;
  status: TxStatus;
}

export interface UserTransaction {
  amount: number;
  currency: string;
  date: Timestamp | FieldValue;
  type: TxType;
  sourceTxId: string;
  target: string;
}

export interface Commission {
  amount: number;
  createdAt: Timestamp;
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
