import { jest } from '@jest/globals'

// Uncomment the logger to get the logs.
const mock = jest.fn // console.debug

jest.mock('@harrytwright/logger', () => ({
  info: mock,
  warn: mock,
  error: mock,
  http: mock,
  silly: mock,
  verbose: mock,
  notice: mock,
  timing: mock,
  resume: jest.fn(),
  set: jest.fn(),
}))
