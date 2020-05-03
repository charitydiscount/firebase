import { Client } from '@elastic/elasticsearch';
import { config } from 'firebase-functions';
import { UserTransaction, TxType } from '../tx/types';
import { Program, Commission } from '../entities';
import { flatMap, isDev } from '../util';

const elasticConfig = config().elastic;

let _client: Client;

export const getElasticClient = () => {
  if (!_client) {
    _client = new Client({
      node: elasticConfig.endpoint,
      auth: {
        username: elasticConfig.user,
        password: elasticConfig.pass,
      },
    });
  }

  return _client;
};

const indeces = {
  get PROGRAMS_INDEX() {
    return addEnvPrefix(elasticConfig.index_programs);
  },
  get PRODUCTS_INDEX() {
    return elasticConfig.index_products;
  },
  get FEATURED_CATEGORY() {
    return addEnvPrefix(elasticConfig.featured);
  },
  get COMMISSIONS_INDEX() {
    return addEnvPrefix('tx-in-commissions');
  },
  get DONATIONS_INDEX() {
    return addEnvPrefix('tx-out-donations');
  },
  get CASHOUT_INDEX() {
    return addEnvPrefix('tx-out-cashout');
  },
  get BONUS_INDEX() {
    return addEnvPrefix('tx-bonus');
  },
};

function addEnvPrefix(string: string) {
  return isDev ? `dev-${string}` : string;
}

async function sendBulkRequest(body: any) {
  try {
    const { body: bulkResponse } = await getElasticClient().bulk({
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
        {
          ...t,
          target: t.target.id,
          targetName: t.target.name,
          elasticDate: new Date().toDateString(),
        },
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

export function buildBulkBodyForCommissions(commissions: Commission[]) {
  return flatMap(
    (commission: Commission) => [
      { index: { _index: indeces.COMMISSIONS_INDEX, _id: commission.originId } },
      commission,
    ],
    commissions,
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
  indeces,
  sendBulkRequest,
  buildBulkBodyForTx,
  buildBulkBodyForPrograms,
  buildBulkBodyForCommissions,
};
