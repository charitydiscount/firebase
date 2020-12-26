import { checkObjectWithProperties, CheckResult } from '../checks';
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { sendEmail } from '../email';
import { User } from '../user/user.model';

const _db = admin.firestore();

/**
 * Send mail
 *
 * @param req Express request with mail info in the body
 * @param res Express response
 */
const sendMailNotification = async (req: Request, res: Response) => {
  console.log('Trying to send mail notification');
  const validationResult = validateSettings(req.body);
  if (!validationResult.isValid) {
    return res.status(422).json(validationResult.violations);
  }

  const querySnapshot = await _db
    .collection('users')
    .where('email', '>', '')
    .get();
  let counter = 0;
  querySnapshot.forEach((doc) => {
    const user = doc.data() as User;
    if (!user.disableMailNotification) {
      counter++;
      sendEmail(
        user.email,
        req.body.subject,
        req.body.content.replace('/unsubscribe', '/unsubscribe/' + user.userId),
      )
        .then()
        .catch((error) => {
          console.log(error);
        });
    }
  });

  return res.status(200).json(counter + ' mails were marked for sending');
};

const validateSettings = (data: any): CheckResult => {
  return checkObjectWithProperties(data, [
    { key: 'subject', type: 'string' },
    { key: 'content', type: 'string' },
  ]);
};

export default {
  sendMailNotification,
};
