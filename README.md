<br />

<h1>ECMAScript Safe Assignment Operator</h1>

> [!WARNING]  
> This proposal is actively being developed and [any help is welcome](#help-us-to-improve-this-proposal).

<br />

This proposal introduces a new operator `?=` _(Safe Assignment)_ that transforms the function result into a `[error, null]` tuple if the function throws an error or `[null, result]` if the function returns a value successfully. This operator also works with promises, async functions and any object that implements the [`Symbol.result`](#symbolresult) method.

For example, when doing any I/O operation or interacting with any Promise-based API, it can fail and **it will** fail in the most unexpected ways at runtime. Forgetting to
handle these errors can lead to unexpected behavior and security vulnerabilities.

<br />

```ts
const [error, response] ?= await fetch("https://arthur.place")
```

<hr />
<br />

- [Motivation](#motivation)
- [Proposed features](#proposed-features)
  - [`Symbol.result`](#symbolresult)
  - [The safe assignment operator (`?=`)](#the-safe-assignment-operator-)
    - [On functions](#on-functions)
    - [On objects](#on-objects)
  - [Recursive handling](#recursive-handling)
  - [Promises](#promises)
  - [`using` statement](#using-statement)
- [Pollyfilling](#pollyfilling)
- [Using `?=` on functions and objects without `Symbol.result`](#using--on-functions-and-objects-without-symbolresult)
- [Try/Catch is not enough](#trycatch-is-not-enough)
- [Comparison](#comparison)
- [Similar Prior Art](#similar-prior-art)
- [What this proposal DOES NOT aim to solve](#what-this-proposal-does-not-aim-to-solve)
- [Current limitations](#current-limitations)
- [Help us to improve this proposal](#help-us-to-improve-this-proposal)
- [Authors](#authors)
- [Inspiration](#inspiration)
- [License](#license)

<br />

## Motivation

- **Error Handling**: Simplify error handling by avoiding try-catch blocks.
- **Readability**: Improve code readability by reducing nesting.
- **Consistency**: Make error handling consistent across different APIs.
- **Security**: Make it harder to forget to handle errors.

<br />

<!-- credits to https://www.youtube.com/watch?v=SloZE4i4Zfk -->

How often have you seen code like this?

```ts
async function getData() {
  const response = await fetch("https://api.example.com/data")
  const json = await response.json()
  return validationSchema.parse(json)
}
```

The problem is that the above function can crash your program but doesn't feel the need to tell you about it.

1. `fetch` can reject
2. `json` can reject
3. `parse` can throw
4. Each of these may throw more than one type of error

As such, we propose the adoption of a novel operator `?=` that allows for a more concise and readable error handling.

```ts
async function getData() {
  const [requestError, response] ?= await fetch(
    'https://api.example.com/data'
  )

  if (requestError) {
    handleRequestError(requestError)
    return
  }

  const [parseError, json] ?= await response.json()

  if (parseError) {
    handleParseError(parseError)
    return
  }

  const [validationError, data] ?= validationSchema.parse(json)

  if (validationError) {
    handleValidationError(validationError)
    return
  }

  return data
}
```

<br />

Please read the [what this proposal DOES NOT aim to solve](#what-this-proposal-does-not-aim-to-solve) section to understand the limitations of this proposal.

<br />

## Proposed features

Below is a list of features that this proposal aims to introduce:

<br />

### `Symbol.result`

Any object that implements the `Symbol.result` method can be used with the `?=` operator.

```ts
function example() {
  return {
    [Symbol.result]() {
      return [new Error('123'), null]
    }
  }
}

const [error, result] ?= example() // Function.prototype also implements Symbol.result
// const [error, result] = example[Symbol.result]()

// error is Error('123')
```

The return of the `Symbol.result` method must be a tuple with the first element being the error and the second element being the result.

<br />

### The safe assignment operator (`?=`)

The `?=` operator calls the `Symbol.result` method of the object or function on the right side of the operator.

```ts
const obj = {
  [Symbol.result]() {
    return [new Error('Error'), null]
  }
}

const [error, data] ?= obj
// const [error, data] = obj[Symbol.result]()
```

```ts
function action() {
  return [null, 'data']
}

const [error, data] ?= action(argument)
// const [error, data] = action[Symbol.result](argument)
```

The result should match the format of `[error, null | undefined]` or `[null, data]`.

#### On functions

If the `?=` operator is used in a function, all used parameters are passed to the `Symbol.result` method.

```ts
declare function action(argument: string): string

const [error, data] ?= action(argument1, argument2, ...)
// const [error, data] = action[Symbol.result](argument, argument2, ...)
```

#### On objects

If the `?=` operator is used in an object, nothing is passed to the `Symbol.result` method as parameters.

```ts
declare const obj: { [Symbol.result]: unknown }

const [error, data] ?= obj
// const [error, data] = obj[Symbol.result]()
```

<br />

### Recursive handling

The `[error, null]` tuple is generated in the first error thrown, however, if the `data` in `[null, data]` also contains a `Symbol.result` method, it will be called recursively.

```ts
const obj = {
  [Symbol.result]() {
    return [
      null,
      {
        [Symbol.result]() {
          return [new Error('Error'), null]
        }
      }
    ]
  }
}

const [error, data] ?= obj
// const [error, data] = obj[Symbol.result]()

// error is  Error('string')
```

This behaviors helps to handle all situations with returning promises or objects with `Symbol.result` methods.

- `async function(): Promise<T>`
- `function(): T`
- `function(): T | Promise<T>`

These cases may go from 0 to 2 levels of objects with `Symbol.result` methods, all of them should be handled correctly.

<br />

### Promises

A Promise is the only other implementation besides `Function` that can be used with the `?=` operator.

```ts
const promise = getPromise()
const [error, data] ?= await promise
// const [error, data] = await promise[Symbol.result]()
```

You may have noticed that we might have the usecase of `await` and `?=` together, and that's fine. Since there's a [recursive handling](#recursive-handling), there's no problem in using them together.

```ts
const [error, data] ?= await getPromise()
// const [error, data] = await getPromise[Symbol.result]()
```

Where the execution will follow this order

1. `getPromise[Symbol.result]()` might throw an error when being called (if it's a sync function that returns a promise)
2. If the error was thrown, it will be assigned to `error` and the execution will stop
3. If the error was not thrown, the result will be assigned to `data`, since `data` is a promise, and promises have a `Symbol.result` method, it will be recursively handled
4. If the promise rejects, the error will be assigned to `error` and the execution will stop
5. If the promise resolves, the result will be assigned to `data`

<br />

### `using` statement

The `using` or `await using` statement should also work with the `?=` operator. Everything using does in a normal `using x = y` statement should be done with the `?=` operator.

Errors thrown when the disposable resource is disposed aren't caught by the `?=` operator, in the same way they aren't caught currently by any other feature.

```ts
try {
  using a = b
} catch(error) {
  // handle
}

// now becomes
using [error, a] ?= b

// or with async

try {
  await using a = b
} catch(error) {
  // handle
}

// now becomes
await using [error, a] ?= b
```

Where the `using management flow` is only applied when `error` is `null | undefined` and `a` is truthy and has a `Symbol.dispose` method.

<br />

## Pollyfilling

This whole proposal can be pollifilled with the code at [`pollyfill.js`](./pollyfill.js).

However the `?=` operator can't be pollifilled, so when targetting older JS environemnts, a post-processor should be used to transform the `?=` into the respective `[Symbol.result]` calls.

```ts
const [error, data] ?= await asyncAction(arg1, arg2)
// should become
const [error, data] = await asyncAction[Symbol.result](arg1, arg2)
```

```ts
const [error, data] ?= action()
// should become
const [error, data] = action[Symbol.result]()
```

```ts
const [error, data] ?= obj
// should become
const [error, data] = obj[Symbol.result]()
```

<br />

## Using `?=` on functions and objects without `Symbol.result`

If the function or object does not have a `Symbol.result` method, the `?=` operator should throw a `TypeError`.

<br />

## Try/Catch is not enough

<!-- credits to https://x.com/LeaVerou/status/1819381809773216099 -->

The `try {}` block is rarely useful, since its scoping is not conceptually meaningful.

Effectively, it's more of a code annotation than control flow. Unlike control flow blocks, there is no program state that only makes sense within a `try {}` block.

The `catch {}` block on the other hand **is** actual control flow, and scoping makes complete sense there.

Using `try/catch` blocks has **two main syntax problems**:

```js
// Nests 1 level for each error handling block
async function readData(filename) {
  try {
    const fileContent = await fs.readFile(filename, "utf8")

    try {
      const json = JSON.parse(fileContent)

      return json.data
    } catch (error) {
      handleJsonError(error)
      return
    }
  } catch (error) {
    handleFileError(error)
    return
  }
}

// Declares reassignable variables outside the block which is undesirable
async function readData(filename) {
  let fileContent
  let json

  try {
    fileContent = await fs.readFile(filename, "utf8")
  } catch (error) {
    handleFileError(error)
    return
  }

  try {
    json = JSON.parse(fileContent)
  } catch (error) {
    handleJsonError(error)
    return
  }

  return json.data
}
```

<br />

## Comparison

The `?=` neither `Symbol.result` proposal introduces new logic to the language, in fact we can already reproduce everything that this proposal does with the current, _but verbose and forgetful_, language features:

```ts
try {
  // try expression
} catch (error) {
  // catch code
}

// or

promise
  .then((data) => {
    // try code
  })
  .catch((error) => {
    // catch code
  })
```

is equivalent to:

```ts
const [error, data] ?= expression

if (error) {
  // catch code
} else {
  // try code
}
```

<br />

## Similar Prior Art

This lovely pattern is architecturally present in many languages:

- Go
  - [Error handling](https://go.dev/blog/error-handling-and-go)
- Rust
  - [`?` operator](https://doc.rust-lang.org/rust-by-example/error/result/enter_question_mark.html#introducing-)
  - [`Result` type](https://doc.rust-lang.org/rust-by-example/error/result.html#result)
- Swift
  - [The `try?` operator](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/errorhandling/#Converting-Errors-to-Optional-Values)
- Zig
  - [`try` keyword](https://ziglang.org/documentation/0.10.1/#try)
- _And many others..._

We can't expect this proposal to offer the same level of type safety or strictness as these languages, since this is a dynamic language and the `throw` statement can throw anything, however, we can still make it easier to handle errors in a more consistent way.

<br />

## What this proposal DOES NOT aim to solve

- **Strictly type errors**: The `throw` statement can thrown anything. This proposal respects that principle and does not enforce any type safety on the error handling side. This proposal won't introduce any types to the language and neither be extended to typescript. See [microsoft/typescript#13219](https://github.com/Microsoft/TypeScript/issues/13219) for more information.

- **Handle errors for you**: This proposal aims to facilitate error handling, however you must still write the code to handle it, the proposal just makes it easier to do so.

<br />

## Current limitations

While this proposal is in its early stages, there are some limitations or TBD that we are aware of:

- We need a nomenclature for objects/functions with `Symbol.result` methods. _Resultable_? _Errorable_? We need to define this.

- No `this` usage tested or declared yet. Documentation about it needs to be written.

- There's no syntax improvement for handling `finally` blocks **YET**, however, you can still use the `finally` block as you would normally do:

```ts
try {
  // try code
} catch {
  // catch errors
} finally {
  // finally code
}

// Needs to be done as follows

const [error, data] ?= action()

try {
  if (error) {
    // catch errors
  } else {
    // try code
  }
} finally {
  // finally code
}
```

<br />

## Help us to improve this proposal

This proposal is in its early stages and we need your help to improve it. Please feel free to open an issue or a pull request with your suggestions.

**_Any contribution is welcome!_**

<br />

## Authors

- [Arthur Fiorette](https://github.com/arthurfiorette) <sub>([Twitter](https://x.com/arthurfiorette))</sub>

<br />

## Inspiration

- [This tweet from @LaraVerou](https://x.com/LeaVerou/status/1819381809773216099)
- [Effect TS Error management](https://effect.website/docs/guides/error-management)
- The [`tuple-it`](https://www.npmjs.com/package/tuple-it) npm package, which introduces a very similar concept, but often adds properties to `Promise` and `Function` prototypes, which is not ideal.
- The easiness of forgetting to handle errors in Javascript code.

<br />

## License

This proposal is licensed under the [MIT License](./LICENSE).

<br />
