import { Client } from '@elastic/elasticsearch';
import { config } from 'firebase-functions';

const elasticConfig = config().elastic;

let elastic: Client;

/**
 * Search the programs index based on the provied query (simple search term)
 * @param {String} query
 * @param {Boolean} exact
 */
async function searchPrograms(query: string, exact: boolean = false) {
  if (!elastic) {
    elastic = new Client({
      node: elasticConfig.endpoint,
    });
  }
  let queryOperator = 'prefix';
  if (exact) {
    queryOperator = 'term';
  }

  return search(elasticConfig.index_programs, query, queryOperator, 'name');
}

interface ProductsQueryParams {
  fields: string[];
  page?: number;
  size?: number;
  sort?: string;
  min?: string;
  max?: string;
}

/**
 * Search the programs index based on the provied query (simple search term)
 * @param {String} query
 * @param {ProductsQueryParams} params
 */
async function searchProducts(
  query: string,
  {
    fields = ['title'],
    page = 0,
    size = 50,
    sort,
    min,
    max,
  }: ProductsQueryParams,
) {
  if (!elastic) {
    elastic = new Client({
      node: elasticConfig.endpoint,
    });
  }

  const searchBody: any = {
    from: page,
    size: size,
    query: {
      bool: {
        must: {
          multi_match: {
            query,
            fields,
          },
        },
      },
    },
  };

  if (sort === 'asc' || sort === 'desc') {
    searchBody.sort = [{ price: sort }];
  }

  let minPrice;
  let maxPrice;

  if (min) {
    minPrice = parseInt(min);
  }
  if (max) {
    maxPrice = parseInt(max);
  }

  if (minPrice || maxPrice) {
    searchBody.query.bool.filter = {
      range: { price: {} },
    };

    if (minPrice) {
      searchBody.query.bool.filter.range.price.gte = minPrice;
    }

    if (maxPrice) {
      searchBody.query.bool.filter.range.price.lte = maxPrice;
    }
  }

  try {
    const { body } = await elastic.search({
      index: elasticConfig.index_products,
      body: searchBody,
    });

    return body.hits;
  } catch (e) {
    console.log(e.body);
  }
}

/**
 * Search the programs index based on the provied query (simple search term)
 * @param {String} index
 * @param {String} query
 * @param {String} queryOperator
 * @param {String} field
 */
async function search(
  index: string,
  query: string,
  queryOperator: string,
  field: string,
) {
  try {
    const { body } = await elastic.search({
      index,
      body: {
        from: 0,
        size: 50,
        query: {
          [queryOperator]: {
            [field]: {
              value: query,
            },
          },
        },
      },
    });

    return body.hits;
  } catch (e) {
    console.log(e.body);
  }
}

const featured = () => {
  return searchProducts(elasticConfig.featured || 'iarna', {
    fields: ['category'],
  });
};

export default {
  searchPrograms,
  searchProducts,
  featured,
};
