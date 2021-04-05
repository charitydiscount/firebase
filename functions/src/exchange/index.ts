import { config } from 'firebase-functions';
import fetch = require('node-fetch');
import { parseStringPromise } from 'xml2js';

export const BASE_CURRENCY = 'RON';

export interface ConvertedAmount {
  amount: number;
  currency: string;
}

export async function convertAmount(
  amount: number,
  currency: string,
  targetCurrency: string = BASE_CURRENCY,
): Promise<ConvertedAmount> {
  let targetAmount = amount;

  const officialRate = await getRate(currency);
  if (!officialRate) {
    console.log(`Could not fetch the official rate`);
    // Return the provided amount and use it as it is
    return {
      amount,
      currency,
    };
  }

  const fee = config().exchange.fee || 0.02;
  const rate = officialRate - officialRate * fee;

  try {
    targetAmount = amount * rate;
  } catch (error) {
    console.log(`Currency conversion failed: ${error}`);
    // Return the provided amount and use it as it is
    return {
      amount,
      currency,
    };
  }

  return {
    amount: targetAmount,
    currency: targetCurrency,
  };
}

const getRate = async (currency: string): Promise<number | undefined> => {
  const bnrResponse = await fetch.default('https://www.bnr.ro/nbrfxrates.xml');
  if (bnrResponse.status !== 200) {
    console.error(`Failed to fetch the BNR rates: ${bnrResponse.statusText}`);
    return;
  }

  const xml = await bnrResponse.text();
  const parsedXML = await parseStringPromise(xml);
  const rates = parsedXML.DataSet.Body[0].Cube[0].Rate as any[];
  const rate = rates.find(
    (r: any) => r['$'].currency === currency.toUpperCase(),
  );

  return rate ? parseFloat(rate['_']) : undefined;
};

export const roundAmount = (amount: number) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};
