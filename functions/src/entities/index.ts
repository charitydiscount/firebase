import { firestore } from 'firebase-admin';

export interface Commission {
  amount: number;
  createdAt: firestore.Timestamp;
  currency: string;
  shopId: number | null;
  status: string;
  originId: number;
  reason?: string;
  program: CommissionProgram;
}

export interface CommissionProgram {
  name: string;
  slug?: string;
  paymentType?: string;
  status?: string;
  userLogin?: string;
  logo: string | null;
}

export const commissionKeys = [
  'amount',
  'createdAt',
  'currency',
  'shopId',
  'status',
  'originId',
  'program',
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

export interface Promotion {
  id: number;
  name: string;
  programId: number;
  campaignLogo: string;
  promotionStart: Date;
  promotionEnd: Date;
  landingPageLink: string;
  source: string;
}

export interface Reviewer {
  userId: string;
  name: string;
  photoUrl: string;
}

export interface Review {
  reviewer: Reviewer;
  rating: number;
  description: string;
  createdAt: firestore.Timestamp;
}

export interface ProgramReviews {
  shopUniqueCode: string;
  reviews: { [userId: string]: Review };
}

export interface ProgramOverallRating {
  rating: number;
  count: number;
}
