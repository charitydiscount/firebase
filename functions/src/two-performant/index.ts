import { config } from 'firebase-functions';
import fetch = require('node-fetch');
import camelcaseKeys = require('camelcase-keys');
import { Promotion } from '../entities';
import {
  CommissionsResponse,
  commissionsFromJson,
  Commission,
} from '../commissions/serializer';
import { sleep } from '../util';
import { programsFromJson, toProgramEntity, Program } from './serializers';
import { response } from 'express';

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
export async function getPromotions(): Promise<Promotion[]> {
  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  let promotions: Promotion[] = [];
  try {
    promotions = await getAllEntities(
      get2PPromotionDataForPage,
      'advertiserPromotions',
      { paginationInRoot: true },
    );
  } catch (e) {
    console.log('Failed to read 2p promotions: ' + e.message);
  }

  promotions.forEach((p: Promotion) => {
    p.source = '2p';
    // @ts-ignore
    p.programId = p.program.id;
  });

  return promotions;
}

/**
 * Get promotions for the given affiliate program
 * @param programId Affiliate Program ID
 */
async function getPromotionsForProgram(
  programId: number,
): Promise<Promotion[]> {
  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  const promotions = await getPromotions();
  return promotions.filter((p: any) => p.programId === programId);
}

async function get2PPromotionDataForPage(page: number): Promise<any> {
  const url = `https://api.2performant.com/affiliate/advertiser_promotions?filter[affrequest_status]=accepted&page=${page}&perpage=${perPage}`;
  const twoPResponse = await fetchTwoP(url, authHeaders);
  const respBody = await twoPResponse.json();
  return camelcaseKeys(respBody, { deep: true });
}

/**
 * Get the 2Performant affiliate commissions
 */
export async function getCommissions(): Promise<Commission[]> {
  const commissions = await getAllEntities<Commission>(
    getCommissionsForPage,
    'commissions',
  );
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
  authData: AuthHeaders,
  page: number,
  commissionsPerPage: number,
  params: string,
): Promise<CommissionsResponse> {
  const url = `https://api.2performant.com/affiliate/commissions?page=${page}&perpage=${commissionsPerPage}${params}`;
  const twoPResponse = await fetchTwoP(url, authData);
  if (twoPResponse.status === 429) {
    await sleep(5 * 61 * 1000);
    return await getCommissionsForPage(
      authData,
      page,
      commissionsPerPage,
      params,
    );
  } else {
    const respBody = await twoPResponse.json();
    return commissionsFromJson(respBody);
  }
}

interface GetterOptions {
  params?: string;
  stopWhen?: Function;
  perPage?: number;
  paginationInRoot?: boolean;
}

async function getAllEntities<T>(
  pageRetriever: Function,
  relevantKey: string,
  options?: GetterOptions,
): Promise<T[]> {
  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  const localPerPage = options && options.perPage ? options.perPage : perPage;

  let responseForPage = await pageRetriever(
    authHeaders,
    1,
    localPerPage,
    options !== undefined ? options.params : undefined,
  );

  if (!response) {
    console.log(`Empty response for ${relevantKey}`);
    return [];
  }

  let entities = responseForPage[relevantKey];

  if (options) {
    if (
      options.stopWhen !== undefined &&
      options.stopWhen(responseForPage) === true
    ) {
      return entities;
    }
  }

  const pagination =
    options && options.paginationInRoot === true
      ? responseForPage.pagination
      : responseForPage.metadata.pagination;
  const totalPages = pagination.pages;
  const firstPage = pagination.currentPage;

  for (let page = firstPage + 1; page <= totalPages; page++) {
    responseForPage = await pageRetriever(
      authHeaders,
      page,
      localPerPage,
      options !== undefined ? options.params : undefined,
    );
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
  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  let programs: Program[] = [];
  try {
    programs = await getAllEntities(getProgramsForPage, 'programs');
  } catch (e) {
    console.log('Failed to read 2p programs: ' + e.message);
  }
  return programs.map((twoPP, index) => {
    const program = toProgramEntity(twoPP);
    if (!twoPP.enableLeads) {
      program.defaultLeadCommissionAmount = null;
    }
    if (!twoPP.enableSales) {
      program.defaultSaleCommissionRate = null;
    }
    program.source = '2p';
    program.order = index * 100;
    return program;
  });
}

async function getProgramsForPage(authData: AuthHeaders, page: number) {
  const url = `https://api.2performant.com/affiliate/programs?filter[relation]=accepted&page=${page}&perpage=${perPage}`;
  const twoPResponse = await fetchTwoP(url, authData);
  const respBody = await twoPResponse.json();

  return programsFromJson(respBody);
}

export const getAffiliateCodes = () => {
  return [
    {
      platform: '2p',
      code: authHeaders.uniqueCode,
    },
  ];
};

export default {
  getPromotionsForProgram,
  getCommissions,
  getPrograms,
  getAffiliateCodes,
};
