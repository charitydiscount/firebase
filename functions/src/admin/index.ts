import express = require('express');
import bearerToken = require('express-bearer-token');
import helmet = require('helmet');
import middlewares from '../middlwares';
import bodyParser = require('body-parser');
import programsController from './programs';
import commissionsController from './commissions';
import casesController from './cases';
import donationsController from './donations';
import cashoutController from './cashout';

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

// Charity cases endpoints
app.get('/cases', casesController.getCases);
app.get('/cases/:caseId', casesController.getCase);
app.post('/cases', casesController.createCase);
app.put('/cases/:caseId', casesController.updateCase);
app.delete('/cases/:caseId', casesController.deleteCase);

// Donations endpoints
app.get('/donations', donationsController.getDonations);
app.get('/donations/user/:userId', donationsController.getUserDonations);
app.post('/donations', donationsController.createDonation);
app.put('/donations/:txId', donationsController.updateDonation);

// Cashout endpoints
app.get('/cashout', cashoutController.getWithdrawals);
app.get('/cashout/user/:userId', cashoutController.getUserWithdrawals);
app.post('/cashout', cashoutController.createWithdrawal);
app.put('/cashout/:txId/', cashoutController.updateWithdrawal);

export default app;
