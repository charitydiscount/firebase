export function objectMap(object: object, mapFn: Function) {
  return Object.keys(object).reduce(function(result: object, key) {
    //@ts-ignore
    result[key] = mapFn(object[key]);
    return result;
  }, {});
}
