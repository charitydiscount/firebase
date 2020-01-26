export const isNumber = (value: any): boolean => typeof value === 'number';
export const isString = (value: any): boolean => typeof value === 'string';
export const isBoolean = (value: any): boolean => typeof value === 'boolean';

export interface ExpectedProperty {
  key: string;
  type: string;
  optional?: boolean;
}

export interface TypeViolation {
  key: string;
  expectedType: string;
}
export interface CheckResult {
  isValid: boolean;
  violations: TypeViolation[];
}

export const checkObjectWithProperties = (
  value: any,
  properties: ExpectedProperty[],
): CheckResult => {
  const result: CheckResult = { isValid: true, violations: [] };
  properties.forEach((prop) => {
    const actualType = typeof value[prop.key];
    if (
      actualType !== prop.type &&
      (!prop.optional || (prop.optional && actualType !== 'undefined'))
    ) {
      result.isValid = false;
      result.violations.push({
        key: prop.key,
        expectedType: prop.type,
      });
    }
  });

  return result;
};
