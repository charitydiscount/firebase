export interface Commission {
  originalAmount: number;
  saleAmount: number;
  originalCurrency: string;
  amount: number;
  currency: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  shopId: number | null;
  status: string;
  originId: number;
  reason?: string;
  program: CommissionProgram;
  referralId?: string;
  source: string;
  ipAddress?: string;
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
  description?: string;
  mainUrl: string;
  affiliateUrl: string;
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
  order: number;
}

interface ProgramSnapProperty {
  [uniqueCode: string]: Program;
}

export type ProgramSnapshot = ProgramSnapProperty & {
  updatedAt: FirebaseFirestore.Timestamp;
};

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
  'affiliateUrl',
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
  affiliateUrl: string;
  program: PromotionProgram;
}

export interface CaseImage {
  url: string;
}

export interface CharityCase {
  id?: string;
  title: string;
  description: string;
  site: string;
  images: CaseImage[];
  funds?: number;
}

export interface Roles {
  admin: boolean;
}

export interface UserAccount {
  iban: string;
  name: string;
  nickname?: string;
}

export interface Referral {
  ownerId: string;
  userId: string;
  name: string;
  photoUrl: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
}

export interface ReferralRequest {
  newUserId: string;
  referralCode: string;
  createdAt: FirebaseFirestore.Timestamp;
  valid: boolean | undefined;
  reason: string | undefined;
}

export interface MetaSettings {
  cashoutEmails: object;
}

export interface MetaGeneral {
  bonusPercentage: number;
  userPercentage: number;
  referralPercentage: number;
}

export interface MetaTwoPerformant {
  uniqueCode: string;
  commissionsTwoPSince: FirebaseFirestore.Timestamp | undefined;
}

export interface CommissionEntry {
  [commissionId: number]: Commission;
}

export interface CommissionsMap {
  [userId: string]: CommissionEntry;
}

export type UserCommissions = {
  [userId: string]: CommissionEntry;
} & {
  userId?: string;
};

export enum Source {
  TWO_PERFORMANT = '2p',
  ALTEX = 'altex',
  REFERRAL = 'referral',
}

export function userCommissionsToArray(
  userCommissions: UserCommissions,
): Commission[] {
  const commissions: Commission[] = [];
  for (const userId in userCommissions) {
    for (const commissionId in userCommissions[userId]) {
      commissions.push(userCommissions[userId][commissionId]);
    }
  }

  return commissions;
}

export interface PromotionProgram {
  id: number;
  name: string;
}

export interface Click {
  ipAddress: string;
  ipv6Address: string;
  userId: string;
  programId: string;
  createdAt: FirebaseFirestore.Timestamp;
  deviceType?: string;
}

export interface LocalizedText {
  en: string;
  ro: string;
}
