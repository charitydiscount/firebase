import express = require('express');
import bearerToken = require('express-bearer-token');
import helmet = require('helmet');
import middlewares from '../middlwares';
import elastic from './elastic';

const searchEndpoints = express();

searchEndpoints.use(middlewares.corsMw);
searchEndpoints.options('*', middlewares.corsMw);

searchEndpoints.use(helmet());
searchEndpoints.use(bearerToken());
searchEndpoints.use(middlewares.firebaseAuth);

searchEndpoints.get('/', async (req, res) => {
  const hits = await elastic.searchPrograms(
    req.query.query,
    req.query.exact || false,
  );
  return res.json(hits);
});
searchEndpoints.get('/programs', async (req, res) => {
  const hits = await elastic.searchPrograms(
    req.query.query,
    req.query.exact || false,
  );
  return res.json(hits);
});
searchEndpoints.get('/products', async (req, res) => {
  const hits = await elastic.searchProducts(req.query.query, req.query);
  return res.json(hits);
});
searchEndpoints.get('/products/featured', async (req, res) => {
  const hits = await elastic.featured();
  return res.json(hits);
});

export default searchEndpoints;
