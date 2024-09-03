/// <reference no-default-lib="true"/>

interface SymbolConstructor {
  /**
   * A method that is used with the safe assignment operator `?=`.
   * Any object that implements the `Symbol.result` method should return `[error, undefined]` or `[null, data]` tuple.
   */
  readonly result: unique symbol
}

interface Function {
  [Symbol.result]<T extends (...args: any[]) => any>(
    this: T,
    ...args: Parameters<T>
  ): [ReturnType<T>] extends [never]
    ? readonly [{}, never]
    : ReturnType<T> extends Promise<never>
      ? readonly [{}, never]
      : ReturnType<T> extends Promise<infer R>
        ? Promise<readonly [{}, undefined] | readonly [null, Awaited<R>]>
        : readonly [{}, undefined] | readonly [null, ReturnType<T>]
}

interface Promise<T = unknown> {
  [Symbol.result](): Promise<
    readonly [{}, undefined] | readonly [null, Awaited<T>]
  >
}
