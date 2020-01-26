import express = require('express');
import bearerToken = require('express-bearer-token');
import helmet = require('helmet');
import middlewares from '../middlwares';
import bodyParser = require('body-parser');
import programsController from './programs';
import commissionsController from './commissions';

const app = express();

app.use(middlewares.corsMw);
app.options('*', middlewares.corsMw);

app.use(helmet());
app.use(bearerToken());

// Limit the admin api only to development environment until stable
app.use(middlewares.onlyDevEnv);

app.use(middlewares.firebaseAuth);
app.use(middlewares.adminMw);

app.use(bodyParser.json());

// Program enpoints
app.get('/programs', programsController.getPrograms);
app.get('/programs/:programUniqueCode', programsController.getProgram);
app.post('/programs', programsController.createProgram);
app.put('/programs/:programUniqueCode', programsController.updateProgram);

// User commissions endpoints
app.get('/commissions', commissionsController.getCommissions);
app.get(
  '/user/:userId/commissions',
  commissionsController.getCommissionsOfUser,
);
app.post(
  '/user/:userId/commissions',
  commissionsController.updateUserCommission,
);
app.put(
  '/user/:userId/commissions/:commissionId',
  commissionsController.updateUserCommission,
);

export default app;
