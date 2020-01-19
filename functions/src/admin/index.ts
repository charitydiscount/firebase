import express = require('express');
import bearerToken = require('express-bearer-token');
import helmet = require('helmet');
import middlewares from '../middlwares';
import bodyParser = require('body-parser');
import programsController from './programs';

const app = express();

app.use(middlewares.corsMw);
app.options('*', middlewares.corsMw);

app.use(helmet());
app.use(bearerToken());

app.use(middlewares.firebaseAuth);
app.use(middlewares.adminMw);

app.use(bodyParser.json());

app.get('/programs', programsController.getPrograms);
app.get('/programs/:programUniqueCode', programsController.getProgram);
app.post('/programs', programsController.createProgram);
app.put('/programs/:programUniqueCode', programsController.updateProgram);

export default app;
