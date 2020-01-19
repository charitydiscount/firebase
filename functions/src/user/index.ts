import { auth } from 'firebase-functions';
import { firestore } from 'firebase-admin';

export const createUser = (db: firestore.Firestore, user: auth.UserRecord) =>
  db
    .collection('users')
    .doc(user.uid)
    .create({
      email: user.email,
      name: user.displayName,
      photoUrl: user.photoURL,
      userId: user.uid,
    });

export const createWallet = (db: firestore.Firestore, user: auth.UserRecord) =>
  db
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
