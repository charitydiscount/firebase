import { Client } from '@elastic/elasticsearch';
import { config } from 'firebase-functions';

const elasticConfig = config().elastic;

const client: Client = new Client({
  node: elasticConfig.endpoint,
});

const indeces = {
  PROGRAMS_INDEX: elasticConfig.index_programs,
  PRODUCTS_INDEX: elasticConfig.index_products,
  FEATURED_CATEGORY: elasticConfig.featured,
  COMMISSIONS_INDEX: 'commissions',
  DONATIONS_INDEX: 'donations',
  CASHOUT_INDEX: 'cashout',
  BONUS_INDEX: 'bonus',
};

export default { client, indeces };
