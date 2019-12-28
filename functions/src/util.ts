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

export async function asyncForEach(array: any[], callback: Function) {
  for (const item of array) {
    await callback(item);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
