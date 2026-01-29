import { Forbidden, Unauthorized } from '@hndlr/errors'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import type {
  ProtectedRequest,
  ServerResponse,
} from '../../../types/response.json.type'
import { authorisation } from './authorisation'

describe('authorisation middleware', () => {
  let mockReq: Partial<ProtectedRequest<any, any>>
  let mockRes: Partial<ServerResponse<any>>
  let mockNext: jest.Mock

  beforeEach(() => {
    mockReq = {
      url: '/test-route',
    }
    mockRes = {}
    mockNext = jest.fn()
  })

  describe('permission validation', () => {
    test('should throw SyntaxError when permission is empty string', () => {
      expect(() => authorisation('')).toThrow(SyntaxError)
      expect(() => authorisation('')).toThrow(
        'permission must have a length greater than 0'
      )
    })

    test('should throw SyntaxError when permission is empty array', () => {
      expect(() => authorisation([])).toThrow(SyntaxError)
      expect(() => authorisation([])).toThrow(
        'permission must have a length greater than 0'
      )
    })
  })

  describe('authentication checks', () => {
    test('should return Unauthorized when no auth and allowUnprotected is false', () => {
      const middleware = authorisation('users:read')
      // mockReq.auth is undefined

      middleware(mockReq as any, mockRes as any, mockNext)

      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockNext).toHaveBeenCalledWith(expect.any(Unauthorized))

      const error = mockNext.mock.calls[0][0] as any
      expect(error.message).toBe('/test-route requires authentication')
    })

    test('should call next() when no auth but allowUnprotected is true', () => {
      const middleware = authorisation('users:read', true)
      // mockReq.auth is undefined

      middleware(mockReq as any, mockRes as any, mockNext)

      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockNext).toHaveBeenCalledWith()
    })
  })

  describe('authorization checks', () => {
    test('should call next() when user has required permission', () => {
      mockReq.auth = {
        sub: 'user-123',
        canAccess: jest.fn().mockReturnValue(true),
      } as any

      const middleware = authorisation('users:read')

      middleware(mockReq as any, mockRes as any, mockNext)

      expect(mockReq.auth?.canAccess).toHaveBeenCalledWith('users:read', false)
      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockNext).toHaveBeenCalledWith()
    })

    test('should return Forbidden when user lacks required permission', () => {
      mockReq.auth = {
        sub: 'user-123',
        canAccess: jest.fn().mockReturnValue(false),
      } as any

      const middleware = authorisation('admin:write')

      middleware(mockReq as any, mockRes as any, mockNext)

      expect(mockReq.auth?.canAccess).toHaveBeenCalledWith('admin:write', false)
      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockNext).toHaveBeenCalledWith(expect.any(Forbidden))

      const error = mockNext.mock.calls[0][0] as any
      expect(error.message).toBe('Current user has invalid permissions')
    })

    test('should pass mustMatch parameter to canAccess', () => {
      mockReq.auth = {
        sub: 'user-123',
        canAccess: jest.fn().mockReturnValue(true),
      } as any

      const middleware = authorisation(
        ['users:read', 'users:write'],
        false,
        true
      )

      middleware(mockReq as any, mockRes as any, mockNext)

      expect(mockReq.auth?.canAccess).toHaveBeenCalledWith(
        ['users:read', 'users:write'],
        true
      )
      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockNext).toHaveBeenCalledWith()
    })

    test('should work with array of permissions', () => {
      mockReq.auth = {
        sub: 'user-123',
        canAccess: jest.fn().mockReturnValue(true),
      } as any

      const middleware = authorisation(['users:read', 'posts:read'])

      middleware(mockReq as any, mockRes as any, mockNext)

      expect(mockReq.auth?.canAccess).toHaveBeenCalledWith(
        ['users:read', 'posts:read'],
        false
      )
      expect(mockNext).toHaveBeenCalledWith()
    })
  })
})
