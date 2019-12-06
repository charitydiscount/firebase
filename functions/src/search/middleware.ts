import * as admin from 'firebase-admin';
import cors = require('cors');

const firebaseAuth = (req: any, res: any, next: any) => {
  admin
    .auth()
    .verifyIdToken(req.token)
    .then(() => {
      req.isServiceAccount = true;
      next();
    })
    .catch(() => res.sendStatus(401));
};

const allowedOrigins = [
  'http://localhost:3000',
  'https://charitydiscount.ro',
  'https://charitydiscount.github.io',
];
const corsOptions: cors.CorsOptions = {
  optionsSuccessStatus: 200,
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
      return;
    } else {
      const msg =
        'The CORS policy for this site does not ' +
        'allow access from the specified Origin.';
      callback(new Error(msg), false);
      return;
    }
  },
};

const corsMw = cors(corsOptions);

export default {
  corsMw,
  firebaseAuth,
};
