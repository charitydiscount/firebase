import { firestore } from 'firebase-admin';
import * as mail from '../email';

export interface Contact {
  name: string;
  email: string;
  message: string;
  subject: string;
  userId: string;
}

export async function sendContactMessage(
  db: firestore.Firestore,
  randomId: string,
  ct: Contact,
) {
  const body = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="X-UA-Compatible" content="ie=edge" />
      <title>${ct.subject}</title>
    </head>
    <body>
      From ${ct.name} with ID: ${ct.userId}
      <br/>
      Message: ${ct.message}
      <br/>
      Mail: ${ct.email}
    </body>
  </html>
  `;
  return mail
    .sendEmail('charitydiscount@gmail.com', ct.subject, body)
    .then(() => {
      console.log('Mail from id:' + randomId + ' succesfully sent');
    })
    .catch(() => {
      console.log('Mail failed to be sent for  id:' + randomId);
    });
}
