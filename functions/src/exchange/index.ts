import { config } from 'firebase-functions';
import fetch = require('node-fetch');

export const BASE_CURRENCY = 'RON';

export interface ConvertedAmount {
  amount: number;
  currency: string;
}

interface ExchangeRates {
  base: string;
  date: Date;
  rates: {
    [currencyCode: string]: number;
  };
}

let exchangeRates: ExchangeRates;

export async function convertAmount(
  amount: number,
  currency: string,
  targetCurrency: string = BASE_CURRENCY,
): Promise<ConvertedAmount> {
  // Get the exchange rates
  if (exchangeRates === undefined || exchangeRates.base !== targetCurrency) {
    const exchangeResponse = await fetch.default(
      `https://api.exchangeratesapi.io/latest?base=${targetCurrency}`,
    );
    if (exchangeResponse.status !== 200) {
      console.log(
        `Failed to get the exchange rates: ${exchangeResponse.statusText}`,
      );
      // Return the provided amount and use it as it is
      return {
        amount,
        currency,
      };
    }

    exchangeRates = await exchangeResponse.json();
  }

  let targetAmount = amount;
  try {
    targetAmount =
      amount / (exchangeRates.rates[currency] + config().exchange.fee);
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
