import { config } from 'firebase-functions';
import fetch = require('node-fetch');
import camelcaseKeys = require('camelcase-keys');
import { Promotion } from '../entities';
import memjs = require('memjs');

const memcache = memjs.Client.create(
  `${config().cache.user}:${config().cache.pass}@${config().cache.endpoint}`,
);

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

async function getPromotions(): Promise<Promotion[]> {
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

  await memcache.set('2p-promotions', promotions.toString(), { expires: 3600 });

  return promotions;
}

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
  const headers = {
    'access-token': authHeaders.accessToken,
    'client': authHeaders.client,
    'uid': authHeaders.uid,
    'token-type': authHeaders.tokenType,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  const twoPResponse = await fetch.default(url, {
    method: 'get',
    headers,
  });

  const respBody = await twoPResponse.json();

  return camelcaseKeys(respBody, { deep: true });
}

export default { getPromotionsForProgram };
