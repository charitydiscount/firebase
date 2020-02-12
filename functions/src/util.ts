import { firestore, instanceId } from 'firebase-admin';

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
