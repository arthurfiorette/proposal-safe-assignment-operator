Symbol.result = Symbol('result');

Function.prototype[Symbol.result] = function (...args) {
  try {
    const result = this(args);

    // Handles recursive cases, like async function() {}
    // or user made implementations like function() { return objectWithSymbolResult }
    if (Symbol.result in result) {
      return result[Symbol.result]();
    }

    return [null, result];
  } catch (error) {
    return [error];
  }
};

Promise.prototype[Symbol.result] = async function () {
  try {
    return [null, await this];
  } catch (error) {
    return [error];
  }
};
