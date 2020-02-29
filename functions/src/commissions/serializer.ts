import camelcaseKeys = require('camelcase-keys');
import * as entity from '../entities';
import { firestore } from 'firebase-admin';
import { convertAmount, BASE_CURRENCY, roundAmount } from '../exchange';

export interface CommissionsResponse {
  commissions: Commission[];
  metadata: Metadata;
}

export interface Commission {
  id: number;
  userId: number;
  actionid: number;
  amount: string;
  status: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  reason: null | string[];
  statsTags: string | null;
  history: null;
  currency: string;
  workingCurrencyCode: string;
  programId: number;
  registeredInBudgetLock: boolean;
  amountInWorkingCurrency: string;
  actiontype: string;
  program: CommissionProgram;
  publicActionData: PublicActionData;
  publicClickData: PublicClickData;
  source: string;
}

export interface CommissionProgram {
  name: string;
  slug: string;
  paymentType: string;
  status: string;
  userLogin: string;
  logo: string;
}

export interface PublicActionData {
  createdAt: string;
  updatedAt: string;
  rate: null;
  amount: null;
  adType: string;
  adId: string;
  sourceIp: string;
  description: string;
}

export interface PublicClickData {
  createdAt: string;
  sourceIp: string;
  url: string;
  redirectTo: string;
  statsTags: string | null;
  deviceType: string;
}

export interface Metadata {
  totals: Totals;
  pagination: Pagination;
  programs: ProgramElement[];
  facets: Facets;
}

export interface Facets {
  search: Available;
  available: Available;
}

export interface Available {
  status: RegistrationMonth[];
  registrationMonth: RegistrationMonth[];
}

export interface RegistrationMonth {
  value: string;
  count: number;
}

export interface Pagination {
  results: number;
  pages: number;
  currentPage: number;
}

export interface ProgramElement {
  name: string;
  id: number;
}

export interface Totals {
  amount: string;
  transactionAmount: null;
  results: number;
}

export const commissionsFromJson = (json: any): CommissionsResponse => {
  //@ts-ignore
  return camelcaseKeys(json, { deep: true });
};

export const toCommissionEntity = async (
  comm: Commission,
  userPercent: number,
): Promise<entity.Commission> => {
  const userAmount =
    Number.parseFloat(comm.amountInWorkingCurrency) * userPercent;
  let convertedUserAmount = userAmount;
  let currency = comm.workingCurrencyCode;
  if (comm.workingCurrencyCode !== BASE_CURRENCY) {
    const conversionResult = await convertAmount(
      userAmount,
      comm.workingCurrencyCode,
    );
    convertedUserAmount = conversionResult.amount;
    currency = conversionResult.currency;
  }
  const commission: entity.Commission = {
    originalAmount: roundAmount(
      Number.parseFloat(comm.amountInWorkingCurrency),
    ),
    amount: roundAmount(convertedUserAmount),
    originalCurrency: comm.workingCurrencyCode,
    currency: currency,
    shopId: comm.programId,
    status: comm.status,
    originId: comm.id,
    program: comm.program,
    createdAt: firestore.Timestamp.fromMillis(Date.parse(comm.createdAt)),
    updatedAt: firestore.Timestamp.fromMillis(Date.parse(comm.updatedAt)),
    source: comm.source,
  };
  if (comm.reason && Array.isArray(comm.reason)) {
    commission.reason = comm.reason.join(' ');
  }
  return commission;
};
