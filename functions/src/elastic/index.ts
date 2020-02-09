import { Client } from '@elastic/elasticsearch';
import { config } from 'firebase-functions';
import { UserTransaction, TxType } from '../tx/types';
import { Program } from '../entities';
import { flatMap } from '../util';
import admin = require('firebase-admin');

const elasticConfig = config().elastic;

const client: Client = new Client({
  node: elasticConfig.endpoint,
  auth: {
    username: elasticConfig.user,
    password: elasticConfig.pass,
  },
});

const indeces = {
  PROGRAMS_INDEX: addEnvPrefix(elasticConfig.index_programs),
  PRODUCTS_INDEX: addEnvPrefix(elasticConfig.index_products),
  FEATURED_CATEGORY: addEnvPrefix(elasticConfig.featured),
  COMMISSIONS_INDEX: addEnvPrefix('tx-in-commissions'),
  DONATIONS_INDEX: addEnvPrefix('tx-out-donations'),
  CASHOUT_INDEX: addEnvPrefix('tx-out-cashout'),
  BONUS_INDEX: addEnvPrefix('tx-bonus'),
};

function addEnvPrefix(string: string) {
  const isDev =
    admin.instanceId().app.options.projectId === 'charitydiscount-test';
  return isDev ? `dev-${string}` : string;
}

async function sendBulkRequest(body: any) {
  try {
    const { body: bulkResponse } = await client.bulk({
      body,
    });
    if (bulkResponse.errors) {
      const erroredDocuments: any[] = [];
      bulkResponse.items.forEach((action: any, i: number) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: body[i * 2],
            document: body[i * 2 + 1],
          });
        }
      });
      console.log(erroredDocuments);
    }
  } catch (e) {
    console.log(e);
  }
}

function buildBulkBodyForTx(transactions: UserTransaction[]) {
  const body: any[] = [];
  transactions.forEach((t) => {
    body.push(
      ...[
        {
          index: {
            _index: getIndexForTx(t),
            _id: t.sourceTxId,
          },
        },
        { ...t, elasticDate: new Date().toDateString() },
      ],
    );
  });
  return body;
}

export function buildBulkBodyForPrograms(programs: Program[]) {
  return flatMap(
    (program: Program) => [
      { index: { _index: indeces.PROGRAMS_INDEX, _id: program.id } },
      program,
    ],
    programs,
  );
}

function getIndexForTx(transaction: UserTransaction) {
  switch (transaction.type) {
    case TxType.BONUS:
      return indeces.BONUS_INDEX;
    case TxType.CASHOUT:
      return indeces.CASHOUT_INDEX;
    case TxType.COMMISSION:
      return indeces.COMMISSIONS_INDEX;
    case TxType.DONATION:
      return indeces.DONATIONS_INDEX;
    default:
      throw new Error('Unkown transaction type');
  }
}

export default {
  client,
  indeces,
  sendBulkRequest,
  buildBulkBodyForTx,
  buildBulkBodyForPrograms,
};
