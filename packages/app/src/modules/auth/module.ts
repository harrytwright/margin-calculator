import crypto from 'crypto'
import fs from 'fs/promises'

import {
  Inject,
  UsesConfig,
  WillBootstrap,
  register,
} from '@harrytwright/api/dist/core'
import { Config } from '@harrytwright/cli-config'
import log from '@harrytwright/logger'
import { InternalServerError } from '@hndlr/errors'
import type {
  JwtHeader,
  SigningKeyCallback,
  VerifyCallback,
} from 'jsonwebtoken'
import JsonWebToken from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

import { AppConfig } from '../../config'

const base64regex =
  /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/

@register('singleton')
export class Auth implements WillBootstrap, UsesConfig {
  @Inject('config')
  config: Config<AppConfig>

  client?: jwksClient.JwksClient

  jwtPerm?: string

  // Does this need to be named this? As it technically parses anything and doesn't do any checks?
  static async parseKSAKey(str: string): Promise<string> {
    const isFile = await checkFileExists(str)
    const isBase64 = !isFile && base64regex.test(str)

    if (isFile) {
      log.verbose('auth:jwt:parse', { file: str }, 'Received pem file')
      str = await fs.readFile(str, { encoding: 'utf8' })
    } else if (isBase64) {
      log.verbose('auth:jwt:parse', 'Received a base64 string')
      str = Buffer.from(str, 'base64').toString('utf8')
    }

    return str
  }

  async bootstrap() {
    if (this.config.get('auth-public-key')) {
      // So for this, even though it is a certificate, we will allow secrets too, along w/ file URI
      let cert = await Auth.parseKSAKey(this.config.get('auth-public-key'))

      // Assume anything else is a secret
      const isPublicKey = isValidPublicKey(cert)

      isPublicKey && log.info('auth:jwt', 'Linking auth with public key')
      !isPublicKey && log.info('auth:jwt', 'Linking auth with secret')

      log.verbose(
        'auth:jwt',
        'Setting %s\n%s',
        isPublicKey ? 'public key' : 'secret',
        cert
      )

      if (!this.config.get('test')) {
        !isPublicKey &&
          log.warn(
            'auth:jwt',
            'Using a secret very insecure, do not use in production'
          )
        isPublicKey &&
          log.warn(
            'auth:jwt',
            'The use of anything but the JWK URI is disparaged during production'
          )
      }

      this.jwtPerm = cert
    } else {
      log.info('auth:jwt', 'Linking auth with auth service')
      log.verbose(
        'auth:jwt',
        'setting jwksUri @ %o',
        this.config.get('auth-api')
      )

      this.client = jwksClient({
        jwksUri: this.config.get('auth-api'),
      })
    }
  }

  // This is only called when we know client exists
  private getSigningKey(header: JwtHeader, callback: SigningKeyCallback) {
    if (this.client === undefined)
      return callback(
        new InternalServerError(
          'Improper auth set-up. Contact developers @ `dev@lanelink.com`'
        )
      )

    this.client!.getSigningKey(header.kid, function (err, key) {
      if (err) return callback(err)

      var signingKey = key!.getPublicKey()
      callback(err, signingKey)
    })
  }

  verify(jwt: string, callback: VerifyCallback) {
    JsonWebToken.verify(
      jwt,
      this.jwtPerm || this.getSigningKey.bind(this),
      {},
      callback
    )
  }
}

export function isValidPublicKey(pubKeyString: string): boolean {
  // Check if the string has the PEM format markers
  const pemHeader = '-----BEGIN PUBLIC KEY-----'
  const pemFooter = '-----END PUBLIC KEY-----'
  if (!pubKeyString.includes(pemHeader) || !pubKeyString.includes(pemFooter)) {
    return false
  }

  try {
    // Use the crypto module to validate the public key
    const keyObject = crypto.createPublicKey(pubKeyString)
    // Attempt to export the key to confirm it's valid
    const exportedKey = keyObject.export({ type: 'spki', format: 'pem' })
    return !!exportedKey
  } catch (error) {
    // If an error occurs during validation or export, it's not a valid public key
    return false
  }
}

export function isValidPrivateKey(privKeyString: string): boolean {
  // Check if the string has the PEM format markers
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  if (
    !privKeyString.includes(pemHeader) ||
    !privKeyString.includes(pemFooter)
  ) {
    return false
  }
  return true
}

function checkFileExists(file: string): Promise<boolean> {
  return fs
    .access(file, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
}
