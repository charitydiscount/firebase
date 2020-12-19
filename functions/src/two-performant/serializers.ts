import camelcaseKeys = require('camelcase-keys');
import { pick } from '../util';
import * as entity from '../entities';

export interface ProgramsResponse {
  programs: Program[];
  metadata: Metadata;
}

export interface Metadata {
  facets: Facets;
  commissionVariation: MetadataCommissionVariation;
  pagination: Pagination;
}

export interface MetadataCommissionVariation {
  days: number;
  forTopProgramsNumber: number;
}

export interface Facets {
  search: Available;
  available: Available;
}

export interface Available {
  status: AffrequestStatus[];
  categoryName: AffrequestStatus[];
  countryName: AffrequestStatus[];
  paymentType: AffrequestStatus[];
  affrequestStatus?: AffrequestStatus[];
}

export interface AffrequestStatus {
  value: string;
  count: number;
}

export interface Pagination {
  results: number;
  pages: number;
  currentPage: number;
}

export interface Program {
  id: number;
  slug: string;
  name: string;
  mainUrl: string;
  baseUrl: string;
  description: string;
  activatedAt: Date;
  userId: number;
  uniqueCode: string;
  status: string;
  cookieLife: number;
  tos: null | string;
  productFeedsCount: number;
  productsCount: number;
  bannersCount: number;
  approvalTime: number;
  currency: Currency;
  workingCurrencyCode: Currency;
  enableLeads: boolean;
  enableSales: boolean;
  defaultLeadCommissionAmount: null | string;
  defaultLeadCommissionType: null | string;
  defaultSaleCommissionRate: null | string;
  defaultSaleCommissionType: DefaultSaleCommissionType | null;
  approvedCommissionCountRate: string;
  approvedCommissionAmountRate: string;
  paymentType: PaymentType;
  balanceIndicator: BalanceIndicator;
  downtime: string;
  averagePaymentTime: number;
  logoId: number;
  logoPath: string;
  userLogin: string;
  category: Category;
  ignoreIps: IgnoreIP[];
  sellingCountries: SellingCountry[];
  promotionalMethods: PromotionalMethods | null;
  commissionVariation: ProgramCommissionVariation;
  affrequest: Affrequest;
}

export interface Affrequest {
  status: AffrequestStatusEnum;
  id: number;
  deleteAt: null;
  suspendAt: null;
  customConditions: boolean;
  customCookieLife: boolean;
  customCommission: boolean;
  cookieLife: number;
  commissionSaleRate: null | string;
  commissionLeadAmount: null | string;
}

export enum AffrequestStatusEnum {
  Accepted = 'accepted',
  Deleted = 'deleted',
}

export enum BalanceIndicator {
  Green = 'green',
  Red = 'red',
  Yellow = 'yellow',
}

export interface Category {
  name: string;
  id: number;
  programsCount: number;
  averageApprovalRateAmount: number;
  averageApprovalRateCount: number;
  oldestPendingCommission: number;
  commission: number;
}

export interface ProgramCommissionVariation {
  change: string;
}

export enum Currency {
  Bgn = 'BGN',
  Eur = 'EUR',
  Gbp = 'GBP',
  Ron = 'RON',
}

export enum DefaultSaleCommissionType {
  Percent = 'percent',
  Variable = 'variable',
}

export interface IgnoreIP {
  ip: string;
}

export enum PaymentType {
  Postpaid = 'postpaid',
  Prepaid = 'prepaid',
}

export interface PromotionalMethods {
  googlePPC: GooglePPC;
  paidSocialMedia: GooglePPC;
}

export enum GooglePPC {
  Allowed = 'allowed',
  NotAllowed = 'not_allowed',
  ToDiscuss = 'to_discuss',
}

export interface SellingCountry {
  id: number;
  name: string;
  code: string;
  currency: Currency;
}

export interface PromotionsResponse {
  advertiser_promotions: {};
  pagination: Pagination;
}

export const programsFromJson = (json: any): ProgramsResponse => {
  //@ts-ignore
  return camelcaseKeys(json, { deep: true });
};

export const toProgramEntity = (program: Program) => {
  //@ts-ignore
  const entityProgram: entity.Program = pick(program, entity.programKeys);
  entityProgram.category = program.category.name;
  return entityProgram;
};
