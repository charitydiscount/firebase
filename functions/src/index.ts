import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

export const createWalletDocument = functions.auth
  .user()
  .onCreate(async (user: functions.auth.UserRecord) => {
    await admin
      .firestore()
      .collection('points')
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

enum TxType {
  DONATION = 'DONATION',
  CASHOUT = 'CASHOUT',
  BONUS = 'BONUS',
};

enum TxStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PENDING = 'PENDING',
};

export const processTransaction = functions.firestore
  .document('transactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const tx = snap.data();
    if (!tx) {
      console.log(`Undefined transaction`);
      return;
    }
    const walletRef = db.doc(`points/${tx.userId}`);
    const userWallet = await walletRef.get();
    if (!userWallet || !userWallet.exists) {
      console.log(`Invalid user ${tx.userId}`);
      return;
    }

    const balance = userWallet.data()!.cashback!.approved;

    if (tx.amount > balance) {
      console.log(`Not enough balance available`);
      await snap.ref.update({ status: TxStatus.REJECTED });
      return;
    }

    const txTimestamp = admin.firestore.Timestamp.fromDate(new Date());

    try {
      switch (tx.type) {
        case TxType.DONATION:
          const meta = await db.doc('meta/2performant').get();
          const bonusPercentage = meta.data()!.bonusPercentage || 0;
          await walletRef.update({
            "cashback.approved": balance - tx.amount,
            "points.approved": tx.amount * bonusPercentage,
            "transactions": admin.firestore.FieldValue.arrayUnion(
              {
                amount: tx.amount,
                currency: tx.currency,
                date: txTimestamp,
                type: tx.type
              },
              {
                amount: tx.amount * 0.2,
                currency: tx.currency,
                date: txTimestamp,
                type: TxType.BONUS
              }),
          });
          break;
        case TxType.CASHOUT:
          await walletRef.update({
            "cashback.approved": balance - tx.amount,
            "transactions": admin.firestore.FieldValue.arrayUnion(
              {
                amount: tx.amount,
                currency: tx.currency,
                date: txTimestamp,
                type: tx.type
              })
          });
          break;
        default:
          break;
      }
    } catch (e) {
      console.log(`Failed to update the user wallet: ${e}`);
      return;
    }

    await snap.ref.update({ status: TxStatus.ACCEPTED });
  });
