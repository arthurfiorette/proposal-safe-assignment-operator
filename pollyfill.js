Symbol.result = Symbol("result")

Function.prototype[Symbol.result] = function (...args) {
  try {
    const result = this(args)

    // Handles recursive cases, like async function() {}
    // or user made implementations like function() { return objectWithSymbolResult }
    if (Symbol.result in result) {
      return result[Symbol.result]()
    }

    return [null, result]
  } catch (error) {
    // throw undefined would break the pattern of destructuring the result type.
    // in [error, data], both error and data would be undefined
    if (!error) {
      return [new Error("Thrown error is falsy")]
    }

    return [error]
  }
}

Promise.prototype[Symbol.result] = async function () {
  try {
    return [null, await this]
  } catch (error) {
    if (!error) {
      return [new Error("Thrown error is falsy")]
    }

    return [error]
  }
}
