import elastic, { getElasticClient } from '../elastic';
import _ = require('lodash');

/**
 * Search the programs index based on the provied query (simple search term)
 * @param {String} query
 * @param {Boolean} exact
 */
async function searchPrograms(query: string, exact: boolean = false) {
  let queryOperator = 'prefix';
  if (exact) {
    queryOperator = 'term';
  }

  return search(elastic.indeces.PROGRAMS_INDEX, query, queryOperator, 'name');
}

interface ProductsQueryParams {
  page?: number;
  size?: number;
  sort?: string;
  min?: string;
  max?: string;
  field?: string;
}

/**
 * Search the programs index based on the provied query (simple search term)
 * @param {String} query
 * @param {ProductsQueryParams} params
 */
async function searchProducts(
  query: string,
  { page = 0, size = 50, sort, min, max, field = 'title' }: ProductsQueryParams,
) {
  const searchBody: any = {
    from: page,
    size: size,
    query: {
      bool: {
        must: {
          match_phrase: {
            [field]: { query, slop: 1 },
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
    const { body } = await getElasticClient().search({
      index: elastic.indeces.PRODUCTS_INDEX,
      body: searchBody,
    });

    return body.hits;
  } catch (e) {
    console.log(e);
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
    const { body } = await getElasticClient().search({
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
    console.log(e);
  }
}

const featured = async () => {
  const categories = [
    'rochii',
    'telefone',
    'carte',
    'pantofi',
    'ochelari',
    'animale',
  ];
  try {
    const { body } = await getElasticClient().msearch({
      body: _.flatten([
        ...categories.map((category) => [
          { index: elastic.indeces.PRODUCTS_INDEX },
          {
            size: 20,
            query: {
              function_score: {
                query: { match: { category } },
                random_score: {},
              },
            },
          },
        ]),
      ]),
    });

    return {
      hits: _.flatMap(body.responses.map((r: any) => r.hits.hits)),
    };
  } catch (e) {
    console.log(e);
  }

  // Fallback to old strategy
  return searchProducts(elastic.indeces.FEATURED_CATEGORY, {
    field: 'category',
  });
};

export default {
  searchPrograms,
  searchProducts,
  featured,
};
