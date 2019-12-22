import { firestore } from 'firebase-admin';
import { UserRecord } from 'firebase-functions/lib/providers/auth';
import * as mail from '../email';

interface Otp {
  code: number;
  generatedAt: firestore.Timestamp | firestore.FieldValue;
  used: boolean;
}

export async function handleNewOtp(db: firestore.Firestore, user: UserRecord) {
  const code = generateCode();
  try {
    await updateFirestore(db, user.uid, code);
    await sendEmail(user, code);
    console.log(`email sent to ${user.email}`);
  } catch (e) {
    console.log(e);
  }

  return 0;
}

function generateCode() {
  return Math.floor(1000 + Math.random() * 9000);
}

function updateFirestore(
  db: firestore.Firestore,
  userId: string,
  code: number,
) {
  const otp: Otp = {
    code,
    generatedAt: firestore.FieldValue.serverTimestamp(),
    used: false,
  };
  return db.doc(`otps/${userId}`).set(otp);
}

function sendEmail(user: UserRecord, code: number) {
  const body = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="X-UA-Compatible" content="ie=edge" />
      <title>Transaction Authorization</title>
    </head>
    <body>
      <p>Hello ${user.displayName},</p>
      <p>Use the following code to authorize the transaction:</p>
      <p><strong>${code}</strong></p>
      <p>Thanks and happy shopping,</p>
      <p>Your CharityDiscount team</p>
    </body>
  </html>
  `;
  return mail.sendEmail(user.email!, 'Transaction authorization', body);
}
