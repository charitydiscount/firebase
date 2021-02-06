import { config } from 'firebase-functions';
import fetch = require('node-fetch');
import camelcaseKeys = require('camelcase-keys');
import { Promotion, Source } from '../entities';
import {
  sleep,
  USER_LINK_PLACEHOLDER,
  PROGRAM_LINK_PLACEHOLDER,
} from '../util';
import {
  programsFromJson,
  toProgramEntity,
  Program,
  ProgramsResponse,
  PromotionsResponse,
} from './serializers';
import moment = require('moment');

interface AuthHeaders {
  accessToken: string;
  client: string;
  uid: string;
  tokenType: string;
  uniqueCode: string;
}

let authHeaders: AuthHeaders;
const perPage = 40;

/**
 * Retrieve the 2Performant authentication data
 */
async function getAuthHeaders(): Promise<AuthHeaders> {
  const reqHeaders = { 'Content-Type': 'application/json' };
  const reqBody = {
    user: { email: config().twop.email, password: config().twop.pass },
  };

  const twoPResponse = await fetch.default(
    'https://api.2performant.com/users/sign_in',
    {
      method: 'post',
      headers: reqHeaders,
      body: JSON.stringify(reqBody),
    },
  );

  if (!twoPResponse.ok) {
    throw new Error(`Failed auth request: ${twoPResponse.statusText}`);
  }

  const resBody = await twoPResponse.json();

  const authData = {
    accessToken: twoPResponse.headers.get('access-token') || '',
    client: twoPResponse.headers.get('client') || '',
    uid: twoPResponse.headers.get('uid') || '',
    tokenType: twoPResponse.headers.get('token-type') || '',
    uniqueCode: resBody.user.unique_code,
  };
  return authData;
}

/**
 * Get all 2performant program promotions
 */
export async function getPromotions(
  affiliateCode: string,
): Promise<Promotion[]> {
  let promotions: Promotion[] = [];
  try {
    promotions = await getAllEntities<Promotion, PromotionsResponse>(
      get2PPromotionDataForPage,
      'advertiserPromotions',
      { paginationInRoot: true },
    );
  } catch (e) {
    console.log('Failed to read 2p promotions: ' + e.message);
  }

  promotions.forEach((p: Promotion) => {
    p.source = Source.TWO_PERFORMANT;
    // @ts-ignore
    p.programId = p.program.id;
    p.affiliateUrl = buildAffiliateUrl(affiliateCode, p.landingPageLink);
  });

  return promotions;
}

async function get2PPromotionDataForPage(
  page: number,
  localPerPage: number,
): Promise<any> {
  const url = `https://api.2performant.com/affiliate/advertiser_promotions?filter[affrequest_status]=accepted&page=${page}&perpage=${localPerPage}`;
  const twoPResponse = await fetchTwoP(url, authHeaders);
  const respBody = await twoPResponse.json();
  authHeaders.accessToken = twoPResponse.headers.get('access-token') || '';
  return camelcaseKeys(respBody, { deep: true });
}

/**
 * Get the 2Performant affiliate commissions
 */
export async function getCommissions2P(since?: Date): Promise<Commission[]> {
  const commissions = await getAllEntities<Commission, CommissionsResponse>(
    getCommissionsForPage,
    'commissions',
    {
      params: '&sort[date]=desc',
      stopWhen: (comResponse) =>
        (since &&
          comResponse.commissions.find((comm) =>
            moment(comm.createdAt).isBefore(moment(since)),
          ) !== null) ||
        false,
    },
  );
  commissions.forEach((c) => (c.source = Source.TWO_PERFORMANT));
  return commissions;
}

async function fetchTwoP(url: string, authData: AuthHeaders) {
  const headers = {
    'access-token': authData.accessToken,
    'client': authData.client,
    'uid': authData.uid,
    'token-type': authData.tokenType,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  const twoPResponse = await fetch.default(url, {
    method: 'get',
    headers,
  });

  if (twoPResponse.status !== 200) {
    console.log(`2P fetch failed: ${twoPResponse.statusText}`);
  }

  return twoPResponse;
}

async function getCommissionsForPage(
  page: number,
  commissionsPerPage: number,
  params?: string,
): Promise<CommissionsResponse> {
  const url = `https://api.2performant.com/affiliate/commissions?page=${page}&perpage=${commissionsPerPage}${params}`;
  const twoPResponse = await fetchTwoP(url, authHeaders);
  if (twoPResponse.status === 429) {
    await sleep(5 * 61 * 1000);
    return await getCommissionsForPage(page, commissionsPerPage, params);
  } else if (twoPResponse.status !== 200) {
    throw twoPResponse.statusText;
  } else {
    const respBody = await twoPResponse.json();
    authHeaders.accessToken = twoPResponse.headers.get('access-token') || '';
    return commissionsFromJson(respBody);
  }
}

interface GetterOptions<T> {
  params?: string;
  stopWhen?: (responseForPage: T) => boolean;
  perPage?: number;
  paginationInRoot?: boolean;
}

async function getAllEntities<T1, T2>(
  pageRetriever: (
    page: number,
    perPage: number,
    params?: string,
  ) => Promise<T2>,
  relevantKey: string,
  options?: GetterOptions<T2>,
): Promise<T1[]> {
  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  const localPerPage = options && options.perPage ? options.perPage : perPage;

  let responseForPage;
  try {
    responseForPage = await pageRetriever(1, localPerPage, options?.params);
  } catch (e) {
    authHeaders = await getAuthHeaders();
  }

  if (!responseForPage) {
    return [];
  }

  //@ts-ignore
  let entities = responseForPage[relevantKey];

  if (options) {
    if (
      options.stopWhen !== undefined &&
      options.stopWhen(responseForPage) === true
    ) {
      return entities;
    }
  }

  let pagination: Pagination;
  if (options && options.paginationInRoot === true) {
    //@ts-ignore
    pagination = responseForPage.pagination;
  } else {
    //@ts-ignore
    pagination = responseForPage.metadata.pagination;
  }

  const totalPages = pagination.pages;
  const firstPage = pagination.currentPage;

  for (let page = firstPage + 1; page <= totalPages; page++) {
    responseForPage = await pageRetriever(page, localPerPage, options?.params);

    //@ts-ignore
    entities = entities.concat(responseForPage[relevantKey]);
    if (options) {
      if (
        options.stopWhen !== undefined &&
        options.stopWhen(responseForPage) === true
      ) {
        break;
      }
    }
  }

  return entities;
}

/**
 * Get the 2Performant affiliate programs
 */
export async function getPrograms() {
  let programs: Program[] = [];
  try {
    programs = await getAllEntities<Program, ProgramsResponse>(
      getProgramsForPage,
      'programs',
    );
  } catch (e) {
    console.log('Failed to read 2p programs: ' + e.message);
  }
  const twoPCode = getAffiliateCodes()[0].code;
  return programs.map((twoPP, index) => {
    const program = toProgramEntity(twoPP);
    if (!twoPP.enableLeads) {
      program.defaultLeadCommissionAmount = null;
    }
    if (!twoPP.enableSales) {
      program.defaultSaleCommissionRate = null;
    }
    program.source = Source.TWO_PERFORMANT;
    program.order = index * 100;
    program.affiliateUrl = buildAffiliateUrl(twoPCode, program.mainUrl);

    return program;
  });
}

async function getProgramsForPage(page: number, localPerPage: number) {
  const url = `https://api.2performant.com/affiliate/programs?filter[relation]=accepted&page=${page}&perpage=${localPerPage}`;
  const twoPResponse = await fetchTwoP(url, authHeaders);
  const respBody = await twoPResponse.json();
  authHeaders.accessToken = twoPResponse.headers.get('access-token') || '';
  return programsFromJson(respBody);
}

export const getAffiliateCodes = () => {
  return [
    {
      platform: Source.TWO_PERFORMANT,
      code: authHeaders.uniqueCode,
    },
  ];
};

const buildAffiliateUrl = (affiliateCode: string, redirectUrl: string) => {
  const baseUrl =
    'https://event.2performant.com/events/click?ad_type=quicklink';
  const affCode = `aff_code=${affiliateCode}`;
  const unique = `unique=${PROGRAM_LINK_PLACEHOLDER}`;
  const redirect = `redirect_to=${redirectUrl}`;
  const tag = `st=${USER_LINK_PLACEHOLDER}`;
  return `${baseUrl}&${affCode}&${unique}&${redirect}&${tag}`;
};

export default {
  getCommissions: getCommissions2P,
  getPrograms,
  getAffiliateCodes,
};

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
  amount: string | null;
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

const commissionsFromJson = (json: any): CommissionsResponse => {
  //@ts-ignore
  return camelcaseKeys(json, { deep: true });
};
