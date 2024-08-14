Symbol.result = Symbol("result")

Function.prototype[Symbol.result] = function (...args) {
  try {
    const result = this.apply(this, args)

    // Handles recursive cases, like async function() {}
    // or user made implementations like function() { return objectWithSymbolResult }
    if (result && typeof result === "object" && Symbol.result in result) {
      return result[Symbol.result]()
    }

    return [null, result]
  } catch (error) {
    // throw undefined would break the pattern of destructuring the result type.
    // in [error, data], both error and data would be undefined
    return [error || new Error("Thrown error is falsy")]
  }
}

Promise.prototype[Symbol.result] = async function () {
  try {
    const result = await this
    return [null, result]
  } catch (error) {
    return [error || new Error("Thrown error is falsy")]
  }
}
