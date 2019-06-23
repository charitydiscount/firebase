import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const createPointsDocument = functions.auth
  .user()
  .onCreate(async (user: functions.auth.UserRecord) => {
    await admin
      .firestore()
      .doc(user.uid)
      .create({
        cashback: {
          approved: 0.0,
          pending: 0.0
        },
        points: {
          approved: 0.0,
          pending: 0.0
        }
      });
  });
