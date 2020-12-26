import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export function importUsersInAuth(): (
  req: functions.https.Request,
  resp: functions.Response<any>,
) => void | Promise<void> {
  return async (req, res) => {
    if (!process.env['FUNCTIONS_EMULATOR']) {
      res
        .status(403)
        .send('ACCESS DENIED. This function is ONLY available via an emulator');
      return;
    }

    // Add some users (make sure to also provide the user ID to match the user's data)
    const users: admin.auth.CreateRequest[] = [];

    let userCount = 0;
    for (const user of users) {
      if (!user.email) {
        return;
      }
      try {
        await admin.auth().createUser(user);
        userCount++;
      } catch (error) {
        console.log(`Error when creating the user: ${error.message}`);
      }
    }

    res.header('Content-type', 'application/json');
    res.status(200).send(JSON.stringify({ userCount }));
  };
}
