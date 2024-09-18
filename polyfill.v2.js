/**
 * @description Safe assignment polyfill V2, introducing Function#result() method,
 * can handle functions that returns Promises.
 * 
 * This polyfill drops `@@result` symbol from first polyfill [/polyfill.js]
 */

Function.prototype.result = function (...args) {
  try {
    const ret = this.apply(this, args);

    if (Object.getPrototypeOf(ret) === Promise.prototype) {
      return ret.then(val => [null, val], err => [err]);
    }

    return [null, ret];

  } catch (err) {
    return [err];
  }
}
