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
import messagesController from './message';
import settingsController from './settings';
import mailsController from './mails';
import clicksController from './clicks';
import achievementsController from './achievements';

const app = express();

app.use(middlewares.corsMw);
app.options('*', middlewares.corsMw);

app.use(helmet());
app.use(bearerToken());

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
    commissionsController.createUserCommission,
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
app.put('/donations/:txId', donationsController.updateDonation);

// Cashout endpoints
app.get('/cashout', cashoutController.getWithdrawals);
app.get('/cashout/user/:userId', cashoutController.getUserWithdrawals);
app.put('/cashout/:txId/', cashoutController.updateWithdrawal);

// Messages endpoints
app.get('/messages', messagesController.getMessages);
app.put('/messages/:meId', messagesController.updateMessage);

// Settings endpoints
app.put('/settings', settingsController.updateSettings);
app.put('/importantCategories', settingsController.updateImportantCategories);

// Mail notification endpoints
app.put('/notifications/mail', mailsController.sendMailNotification);

//Clicks endpoints
app.get('/clicks', clicksController.getClicks);
app.post('/clicks', clicksController.createClick);
app.put('/clicks/:clickId', clicksController.updateClick);

//Achievements endpoints
app.post('/achievements', achievementsController.createNewAchievement);
app.get('/achievements', achievementsController.getAchievements);
app.put('/achievements/:achievementId', achievementsController.updateAchievement);

export default app;
