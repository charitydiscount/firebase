import * as admin from 'firebase-admin';
import cors = require('cors');
import { Request, Response, NextFunction } from 'express';

const firebaseAuth = (req: any, res: any, next: any) => {
  if (!req.token) {
    return res.sendStatus(401);
  }
  return admin
    .auth()
    .verifyIdToken(req.token)
    .then((decodedToken) => {
      req.userId = decodedToken.uid;
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

const adminMw = async (req: any, res: any, next: any) => {
  const userRolesSnap = await admin
    .firestore()
    .collection('roles')
    .doc(req.userId)
    .get();

  if (userRolesSnap.exists && userRolesSnap.data()?.admin === true) {
    return next();
  } else {
    return res.sendStatus(401);
  }
};

export const onlyDevEnv = (req: Request, res: Response, next: NextFunction) => {
  if (admin.instanceId().app.options.projectId === 'charitydiscount-test') {
    next();
    return;
  } else {
    return res.sendStatus(403);
  }
};

export default {
  corsMw,
  firebaseAuth,
  adminMw,
  onlyDevEnv,
};
