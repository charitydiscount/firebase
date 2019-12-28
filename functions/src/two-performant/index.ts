import { config } from 'firebase-functions';
import fetch = require('node-fetch');
import camelcaseKeys = require('camelcase-keys');
import { Promotion } from '../entities';
import memjs = require('memjs');
import {
  CommissionsResponse,
  commissionsFromJson,
  Commission,
} from '../commissions/serializer';
import { sleep } from '../util';

let memcache: memjs.Client;

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
async function getPromotions(): Promise<Promotion[]> {
  if (!memcache) {
    memcache = memjs.Client.create(
      `${config().cache.user}:${config().cache.pass}@${
        config().cache.endpoint
      }`,
    );
  }

  const cachedPromotions = await memcache.get('2p-promotions');
  if (cachedPromotions.value !== null) {
    //@ts-ignore
    return JSON.parse(cachedPromotions.value.toString());
  }

  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  let promotionData = await get2PPromotionDataForPage(1);
  const promotions: any[] = promotionData.advertiserPromotions;

  const totalPages = promotionData.pagination.pages;
  const firstPage = promotionData.pagination.currentPage;

  if (firstPage === totalPages) {
    return promotions;
  }

  for (let page = firstPage + 1; page <= totalPages; page++) {
    promotionData = await get2PPromotionDataForPage(page);
    promotions.push(...promotionData.advertiserPromotions);
  }

  promotions.forEach((p: Promotion) => {
    p.source = '2p';
    // @ts-ignore
    p.programId = p.program.id;
  });

  await memcache.set('2p-promotions', JSON.stringify(promotions), {
    expires: 3600,
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
export async function getPendingCommissions(): Promise<Commission[]> {
  const commissions = await getAllEntities(
    getCommissionsForPage,
    'commissions',
    {
      perPage: 50,
      params: '&filter[status]=pending&sort[date]=desc',
    },
  );
  commissions.push(
    ...(await getAllEntities(getCommissionsForPage, 'commissions', {
      perPage: 50,
      params: 'filter[status]=accepted&sort[date]=desc',
    })),
  );
  return commissions;
}

function fetchTwoP(url: string, authData: AuthHeaders) {
  const headers = {
    'access-token': authData.accessToken,
    'client': authData.client,
    'uid': authData.uid,
    'token-type': authData.tokenType,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  return fetch.default(url, {
    method: 'get',
    headers,
  });
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
}

async function getAllEntities(
  pageRetriever: Function,
  relevantKey: string,
  options?: GetterOptions,
): Promise<any[]> {
  if (!authHeaders) {
    authHeaders = await getAuthHeaders();
  }

  const localPerPage = options && options.perPage ? options.perPage : perPage;

  let responseForPage = await pageRetriever(
    authHeaders,
    1,
    localPerPage,
    options ? options.params : undefined,
  );
  let entities = responseForPage[relevantKey];

  if (options) {
    if (
      options.stopWhen !== undefined &&
      options.stopWhen(responseForPage) === true
    ) {
      return entities;
    }
  }

  const totalPages = responseForPage.metadata.pagination.pages;
  const firstPage = responseForPage.metadata.pagination.currentPage;

  for (let page = firstPage + 1; page <= totalPages; page++) {
    responseForPage = await pageRetriever(
      authHeaders,
      page,
      localPerPage,
      options ? options.params : undefined,
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

export default { getPromotionsForProgram, getPendingCommissions };
