'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
const globals_1 = require('@jest/globals')
// Uncomment the logger to get the logs.
const mock = globals_1.jest.fn // console.debug
globals_1.jest.mock('@harrytwright/logger', () => ({
  info: mock,
  warn: mock,
  error: mock,
  http: mock,
  silly: mock,
  verbose: mock,
  notice: mock,
  timing: mock,
  resume: globals_1.jest.fn(),
  set: globals_1.jest.fn(),
}))
//# sourceMappingURL=logger.js.map
