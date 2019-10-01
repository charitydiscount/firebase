import { auth } from 'firebase-functions';
import { Firestore } from '@google-cloud/firestore';

export const createWallet = (db: Firestore, user: auth.UserRecord) => {
  return db
    .collection('points')
    .doc(user.uid)
    .create({
      cashback: {
        approved: 0.0,
        pending: 0.0,
      },
      points: {
        approved: 0.0,
        pending: 0.0,
      },
    });
};
