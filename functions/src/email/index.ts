import nodemailer = require('nodemailer');
import functions = require('firebase-functions');
import mailgunTransport = require('nodemailer-mailgun-transport');

const mailgunAuth: mailgunTransport.AuthOptions = {
  api_key: functions.config().mail.api_key,
  domain: functions.config().mail.domain,
};

const transporter = nodemailer.createTransport(
  mailgunTransport({ auth: mailgunAuth, host: 'api.eu.mailgun.net' }),
);

/**
 * Send the given email to the given address
 * @param destination The destination email address
 * @param subject The subject of the email
 * @param body The content in html of the email
 */
export const sendEmail = (
  destination: string,
  subject: string,
  body: string,
) => {
  return transporter.sendMail({
    from: {
      name: functions.config().mail.name,
      address: functions.config().mail.user,
    },
    to: destination,
    subject,
    html: body,
  });
};
