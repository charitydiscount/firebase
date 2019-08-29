import { Timestamp } from '@google-cloud/firestore';

export enum TxType {
  DONATION = 'DONATION',
  CASHOUT = 'CASHOUT',
  BONUS = 'BONUS',
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
}

export interface UserTransaction {
  amount: number;
  currency: string;
  date: Timestamp;
  type: TxType;
  sourceTxId: string;
  target: string;
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
  process(tx: TxRequest): Promise<ProcessResult>;
}
