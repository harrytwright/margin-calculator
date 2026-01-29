export interface AuthConfig extends Record<string, any> {
  // The URI for the auth api
  'auth-api': [null, StringConstructor]
  // This is used during development to set a certificate for JWT
  'auth-public-key': [null, StringConstructor]
  // Simple API key used for automation and testing
  'auth-api-key': [null, StringConstructor]
  // Comma separated permissions granted to the API key
  'auth-api-key-permissions': [null, StringConstructor]
}

export const types: AuthConfig = {
  'auth-api': [null, String],
  'auth-public-key': [null, String],
  'auth-api-key': [null, String],
  'auth-api-key-permissions': [null, String],
}

export const defaults = {
  'auth-api': 'http://localhost:3000/auth/jwt/jwks.json',
  'auth-api-key-permissions': 'api:*',
}
