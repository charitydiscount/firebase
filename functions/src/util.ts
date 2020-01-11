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
