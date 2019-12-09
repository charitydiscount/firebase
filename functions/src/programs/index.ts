import express = require('express');
import bearerToken = require('express-bearer-token');
import helmet = require('helmet');
import middlewares from '../middlwares';
import promotions from './promotions';

const app = express();

app.use(middlewares.corsMw);
app.options('*', middlewares.corsMw);

app.use(helmet());
app.use(bearerToken());
app.use(middlewares.firebaseAuth);

app.get('/:programId(\\d+)/promotions', promotions.getForProgram);

export default app;
