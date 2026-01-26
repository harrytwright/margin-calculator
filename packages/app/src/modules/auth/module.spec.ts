import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

import { Auth } from './module'

import {
  ITestingSuite,
  __unsafe_TestingSuite as TestingSuite,
} from '@harrytwright/api/dist/test/testing-suite'
import { cleanup } from '../../../jest/testing-suite'

describe('JWT', function () {
  describe('JWT.parseKSAKey()', function () {
    test('should parse base64 string', async function () {
      const string = `
-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu
KUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQJAIJLixBy2qpFoS4DSmoEm
o3qGy0t6z09AIJtH+5OeRV1be+N4cDYJKffGzDa88vQENZiRm0GRq6a+HPGQMd2k
TQIhAKMSvzIBnni7ot/OSie2TmJLY4SwTQAevXysE2RbFDYdAiEBCUEaRQnMnbp7
9mxDXDf6AU0cN/RPBjb9qSHDcWZHGzUCIG2Es59z8ugGrDY+pxLQnwfotadxd+Uy
v/Ow5T0q5gIJAiEAyS4RaI9YG8EWx/2w0T67ZUVAw8eOMB6BIUg0Xcu+3okCIBOs
/5OiPgoTdSy7bcF9IGpSE8ZgGKzgYQVZeN97YE00
-----END RSA PRIVATE KEY-----
      `.trim()

      expect(
        await Auth.parseKSAKey(Buffer.from(string).toString('base64'))
      ).toEqual(string)
    })

    test('should work with a file', async function () {
      const file = await require('fs/promises').readFile(__filename, {
        encoding: 'utf8',
      })
      expect(await Auth.parseKSAKey(__filename)).toEqual(file)
    })
  })

  // This will only ever check the error as the actual JWK will be tested during staging
  describe('verify()', function () {
    var suite: ITestingSuite

    var fakeJWKURI = 'http://localhost:9876/jwt/jwk.json'

    beforeAll(async () => {
      const { config } = await import('../../config')
      config.load()

      // Override this w/ a fake URI
      config.set('auth-public-key', false)
      config.set('auth-api', fakeJWKURI)

      suite = TestingSuite(Auth)
      await suite.resolve(config)
    })

    afterAll(async () => await cleanup(suite))

    test('should attempt to verify', function (done) {
      const exampleJWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRlc3RlciJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.cQJgjPHPdqE6JmBdSRaBsXng-_1_gcpAyk669PKDD1k'

      suite.get<Auth>(Auth)!.verify(exampleJWT, (error, decoded) => {
        expect(error).toBeDefined()
        expect(decoded).not.toBeDefined()
        done()
      })
    })
  })
})
