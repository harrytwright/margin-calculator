import { describe, expect, test } from '@jest/globals'
import { matcher } from './role-matcher'

describe('role-matcher', function () {
  test('should pass for wildcard', function () {
    expect(matcher('user:read:own', ['user:read:*'])).toBeTruthy()
  })

  test('should pass for same', function () {
    expect(matcher('user:read:own', ['user:read:own'])).toBeTruthy()
  })

  test('should pass `<resource>:<action>`', function () {
    expect(matcher('user:write', ['user:write'])).toBeTruthy()
  })

  test('should pass with global wildcard', function () {
    expect(matcher('user:read:own', ['user:*'])).toBeTruthy()
  })

  test('should fail with invalid scope', function () {
    expect(matcher('user:read:all', ['user:read:own'])).toBeFalsy()
  })

  // This here is when we do further testing during the controller
  test('should work with fine-grained requirements', function () {
    expect(matcher(['user:read', 'user:read:private'], ['user:read:private']))
  })

  // This is where the user must have a combined requirements
  test('should work forced fine-grained requirements', function () {
    expect(
      matcher(
        ['user:read', 'user:read:private'],
        ['user:read', 'user:read:private'],
        true
      )
    )
  })
})
