//
// Proposal: Error-Safe Assignments
//
// Be able to handle errors in assignments without throwing exceptions, in a
// easier way and without let variables + nesting try/catch blocks.
//

const [error, data] ?= await fs.readFile('file.json')
//                     await fs.readFile[Symbol.result]('file.json')
const [error, data] ?= fs.readFileSync('file.json')
//                     fs.readFileSync[Symbol.result]('file.json')

if (error) {
  handleError(error)
  return
}

console.log('file content:', data)