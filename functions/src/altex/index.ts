import puppeteer = require('puppeteer-core');
import { config } from 'firebase-functions';
import moment = require('moment');
import { Commission, UserCommissions, Source } from '../entities';
import { firestore } from 'firebase-admin';
import { roundAmount } from '../exchange';
import { chunk } from 'lodash';
import chromium = require('chrome-aws-lambda');

interface AltexConfig {
  site: string;
  email: string;
  pass: string;
  name: string;
  logo: string;
  id: string;
}

export const getAltexCommissions = async (userPercentage: number) => {
  const altexConfig: AltexConfig = config().altex;
  if (!altexConfig) {
    console.log('Altex env variables missing');
    throw Error('Altex env variables missing');
  }
  const browser = await puppeteer.launch({
    timeout: 5000,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.goto(altexConfig.site);

  // Authenticate
  await page.type('#Username', altexConfig.email);
  await page.type('#Password', altexConfig.pass);
  await page.click('input[name="login"]');

  // Go to reports page
  await page.waitForSelector(
    'a[href="/AffiliateReports/PromoToolPerformanceByDay"]',
  );
  await page.click('a[href="/AffiliateReports/PromoToolPerformanceByDay"]');

  // Go to orders section
  await page.waitForSelector('a[href="/AffiliateReports/Orders"]');
  await page.click('a[href="/AffiliateReports/Orders"]');

  // Expand the timeframe
  await page.waitFor(1000);
  await page.evaluate((selector) => {
    console.log(selector);
    return document.querySelector(selector).click();
  }, '#r2');

  // Clear the default start date
  await page.click('#DateFilterModel_StartDate_Date', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#DateFilterModel_StartDate_Date', '01.11.2019', {
    delay: 100,
  });
  await page.click('#reportsFilters > form > fieldset > input.filter-button');
  await page.waitFor(2000);

  const rawCommissions = await page.evaluate(() => {
    const tds = Array.from(
      document.querySelectorAll('#Grid > table > tbody > tr > td'),
    );
    return tds.map((td) => td.innerHTML);
  });

  await browser.close();

  return chunkCommissions(rawCommissions, userPercentage, altexConfig);
};

const chunkCommissions = (
  rawCommissions: string[],
  userPercentage: number,
  altexConfig: AltexConfig,
): { [userId: string]: { [commissionId: number]: Commission } } => {
  const commissions: UserCommissions = {};

  let originIdSalt = 0;
  let previousDate: moment.Moment;

  const chunkedCommissions = chunk(rawCommissions, 9).reverse();

  for (const rawCommission of chunkedCommissions) {
    const userId = rawCommission[8];
    const commissionDate = moment(rawCommission[1], 'DD.MM.YYYY');
    if (!userId || !commissionDate) {
      continue;
    }

    //@ts-ignore
    if (previousDate !== undefined && previousDate.isSame(commissionDate)) {
      originIdSalt++;
    } else {
      originIdSalt = 0;
    }
    previousDate = commissionDate.clone();

    const commissionId = commissionDate.valueOf() + originIdSalt;

    const commissionAmount = parseFloat(rawCommission[6].replace(',', '.'));
    const saleAmount = parseFloat(rawCommission[4].replace(',', '.'));

    if (commissions[userId] === undefined) {
      commissions[userId] = {};
    }
    commissions[userId][commissionId] = {
      createdAt: firestore.Timestamp.fromMillis(commissionDate.valueOf()),
      updatedAt: firestore.Timestamp.fromMillis(commissionDate.valueOf()),
      status: getAltexCommissionStatus(rawCommission[2]),
      originalAmount: roundAmount(commissionAmount),
      saleAmount: roundAmount(saleAmount),
      originalCurrency: 'RON',
      amount: roundAmount(commissionAmount * userPercentage),
      currency: 'RON',
      source: Source.ALTEX,
      originId: commissionId,
      program: {
        name: altexConfig.name,
        logo: altexConfig.logo,
      },
      shopId: parseInt(altexConfig.id),
    };
  }

  return commissions;
};

export const getAltexCommissionStatus = (rawStatus: any) => {
  let commissionStatus = 'pending';
  switch (rawStatus) {
    case 'In asteptare':
      commissionStatus = 'pending';
      break;
    case 'Aprobat':
      commissionStatus = 'paid';
      break;
    case 'Anulat':
      commissionStatus = 'rejected';
      break;
    default:
      break;
  }
  return commissionStatus;
};
