import { messaging } from 'firebase-admin';

let fcm: messaging.Messaging;
export interface Notification {
  title: string;
  body: string;
  type: string;
}

/**
 * Send the notification to the given devices
 * @param notification - Object with title and body which will be displayed and
 * type metadata which is used by the apps internally
 * @param devices
 */
export const sendNotification = (
  { title, body, type }: Notification,
  devices: string[],
) => {
  if (!fcm) {
    fcm = messaging();
  }

  const notification: messaging.MessagingPayload = {
    notification: {
      title,
      body,
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      type,
    },
  };

  return fcm.sendToDevice(devices, notification).catch((e) => console.log(e));
};

export enum NotificationTypes {
  COMMISSION = 'COMMISSION',
  REWARD = 'REWARD',
}
