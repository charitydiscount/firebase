import { Timestamp } from '@google-cloud/firestore';

export interface Commission {
  amount: number;
  createdAt: Timestamp;
  currency: string;
  shopId: number;
  status: string;
  originId: number;
}

export const commissionKeys = [
  'amount',
  'createdAt',
  'currency',
  'shopId',
  'status',
  'originId',
];

export interface Program {
  id: number;
  name: string;
  mainUrl: string;
  uniqueCode: string;
  status: string;
  productsCount: number;
  currency: string;
  workingCurrencyCode: string;
  defaultLeadCommissionAmount: null | string;
  defaultLeadCommissionType: null | string;
  defaultSaleCommissionRate: null | string;
  defaultSaleCommissionType: DefaultSaleCommissionType | null;
  averagePaymentTime: number;
  logoPath: string;
  category: string;
  sellingCountries: SellingCountry[];
  source: string;
}

export enum DefaultSaleCommissionType {
  Percent = 'percent',
  Variable = 'variable',
}

export interface SellingCountry {
  name: string;
  code: string;
  currency: string;
}

export const programKeys = [
  'id',
  'name',
  'mainUrl',
  'uniqueCode',
  'status',
  'productsCount',
  'currency',
  'workingCurrencyCode',
  'defaultLeadCommissionAmount',
  'defaultLeadCommissionType',
  'defaultSaleCommissionRate',
  'defaultSaleCommissionType',
  'averagePaymentTime',
  'logoPath',
  'category',
  'sellingCountries',
  'source',
];
