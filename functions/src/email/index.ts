import nodemailer = require('nodemailer');
import functions = require('firebase-functions');
import mailgunTransport = require('nodemailer-mailgun-transport');
import Mail = require('nodemailer/lib/mailer');

const mailgunAuth: mailgunTransport.AuthOptions = {
  get api_key() {
    return functions.config().mail.api_key;
  },
  get domain() {
    return functions.config().mail.domain;
  },
};

let transporter: Mail;

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
  if (!transporter) {
    transporter = nodemailer.createTransport(
      mailgunTransport({ auth: mailgunAuth, host: 'api.eu.mailgun.net' }),
    );
  }
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
