import { firestore } from 'firebase-admin';
import { asyncForEach } from '../util';

export const getUserDeviceTokens = async (
  db: firestore.Firestore,
  userId: string,
) => {
  const userTokenDocs = await db
    .collection('users')
    .doc(userId)
    .collection('tokens')
    .listDocuments();
  const userDevices: string[] = [];
  await asyncForEach(userTokenDocs, async (tokenDoc) => {
    const tokenSnap = await tokenDoc.get();
    const device = tokenSnap.data();
    if (
      device &&
      (device.notifications === undefined || device.notifications) &&
      device.token
    ) {
      userDevices.push(device.token);
    }
  });

  return userDevices;
};
