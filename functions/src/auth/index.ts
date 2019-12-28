import express = require('express');
import bearerToken = require('express-bearer-token');
import helmet = require('helmet');
import middlewares from '../middlwares';
import { auth } from 'firebase-admin';

const app = express();

app.use(middlewares.corsMw);
app.options('*', middlewares.corsMw);

app.use(helmet());
app.use(bearerToken());
app.use(middlewares.firebaseAuth);

app.get('/:route', (req, res) => {
  return (
    auth()
      //@ts-ignore
      .createCustomToken(req.userId)
      .then((token) =>
        res.redirect(
          `https://charitydiscount.ro/${req.params.route}?token=${token}&${req.params.itemKey}=${req.params.itemValue}`,
        ),
      )
  );
});

export default app;
