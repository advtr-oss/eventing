export interface Constructor<T> extends Function {
  prototype: T
}

export function constructor<T> (value: T): Constructor<T> {
  // @ts-expect-error
  return value.constructor
}
