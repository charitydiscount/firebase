import { firestore, instanceId, messaging } from 'firebase-admin';

export function objectMap(object: object, mapFn: Function) {
  return Object.keys(object).reduce((result: object, key) => {
    //@ts-ignore
    result[key] = mapFn(object[key]);
    return result;
  }, {});
}

export function flatMap(f: Function, arr: Array<any>) {
  return arr.reduce((x, y) => [...x, ...f(y)], []);
}

export async function asyncForEach<T>(array: T[], callback: (item: T) => any) {
  for (const item of array) {
    await callback(item);
  }
}

export const pick = (
  obj: { [key: string]: any },
  props: string[],
): { [key: string]: any } | undefined => {
  if (!obj || !props) return;

  const picked = {} as { [key: string]: any };

  props.forEach((prop) => {
    if (obj.hasOwnProperty(prop)) {
      picked[prop] = obj[prop];
    }
  });

  return picked;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const groupBy = <T extends Object>(
  array: Array<T>,
  key: string,
): {
  [key: string]: T[];
} => {
  return array.reduce((acc: any, item: T) => {
    //@ts-ignore
    (acc[item[key]] = acc[item[key]] || []).push(item);
    return acc;
  }, {});
};

export const arrayToObject = <T>(
  array: T[],
  key: string,
): { [key: string]: T } => {
  const object: { [key: string]: T } = {};
  array.forEach((item) => {
    //@ts-ignore
    object[item[key]] = item;
  });
  return object;
};

export const deleteDocsOfCollection = async (
  db: firestore.Firestore,
  collection: string,
) => {
  const fireBatch = db.batch();
  const docsToDelete = await db.collection(collection).listDocuments();
  docsToDelete.forEach((doc: any) => {
    fireBatch.delete(doc);
  });
  return fireBatch.commit();
};

export const isDev =
  instanceId().app.options.projectId === 'charitydiscount-test';

export const USER_LINK_PLACEHOLDER = '{userId}';
export const PROGRAM_LINK_PLACEHOLDER = '{programUniqueCode}';

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
