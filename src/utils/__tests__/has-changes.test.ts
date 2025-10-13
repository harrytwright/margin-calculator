import { hasChanges } from '../has-changes'

describe('hasChanges', () => {
  describe('new records', () => {
    it('should return true when existing is undefined', () => {
      type DbRecord = { name: string; value: number }
      const result = hasChanges<DbRecord, { name: string; value: number }>(
        undefined,
        { name: 'Test', value: 42 },
        { name: 'name', value: 'value' }
      )
      expect(result).toBe(true)
    })

    it('should return true when existing is null', () => {
      type DbRecord = { name: string; value: number }
      const result = hasChanges<DbRecord, { name: string; value: number }>(
        null as any,
        { name: 'Test', value: 42 },
        { name: 'name', value: 'value' }
      )
      expect(result).toBe(true)
    })
  })

  describe('direct field mapping', () => {
    it('should return false when all fields match', () => {
      const existing = { name: 'Test', value: 42 }
      const importData = { name: 'Test', value: 42 }

      const result = hasChanges(existing, importData, {
        name: 'name',
        value: 'value',
      })

      expect(result).toBe(false)
    })

    it('should return true when a field has changed', () => {
      const existing = { name: 'Test', value: 42 }
      const importData = { name: 'Updated', value: 42 }

      const result = hasChanges(existing, importData, {
        name: 'name',
        value: 'value',
      })

      expect(result).toBe(true)
    })

    it('should return true when multiple fields have changed', () => {
      const existing = { name: 'Test', value: 42 }
      const importData = { name: 'Updated', value: 100 }

      const result = hasChanges(existing, importData, {
        name: 'name',
        value: 'value',
      })

      expect(result).toBe(true)
    })

    it('should only check mapped fields', () => {
      const existing = { name: 'Test', value: 42, ignored: 'old' }
      const importData = { name: 'Test', value: 42, ignored: 'new' }

      const result = hasChanges(existing, importData, {
        name: 'name',
        value: 'value',
      })

      expect(result).toBe(false)
    })
  })

  describe('function-based field mapping', () => {
    it('should use function to extract import value', () => {
      const existing = { fullName: 'John Doe' }
      const importData = { firstName: 'John', lastName: 'Doe' }

      const result = hasChanges(existing, importData, {
        fullName: (data) => `${data.firstName} ${data.lastName}`,
      })

      expect(result).toBe(false)
    })

    it('should detect changes with function mapping', () => {
      const existing = { fullName: 'John Doe' }
      const importData = { firstName: 'Jane', lastName: 'Smith' }

      const result = hasChanges(existing, importData, {
        fullName: (data) => `${data.firstName} ${data.lastName}`,
      })

      expect(result).toBe(true)
    })

    it('should handle function returning null/undefined', () => {
      const existing = { value: null }
      const importData = { missing: true }

      const result = hasChanges(existing, importData, {
        value: () => undefined,
      })

      expect(result).toBe(false)
    })
  })

  describe('null/undefined normalization', () => {
    it('should treat null and undefined as equal', () => {
      const existing = { value: null }
      const importData = { value: undefined }

      const result = hasChanges(existing, importData, {
        value: 'value',
      })

      expect(result).toBe(false)
    })

    it('should treat undefined and null as equal', () => {
      const existing = { value: undefined }
      const importData = { value: null }

      const result = hasChanges(existing, importData, {
        value: 'value',
      })

      expect(result).toBe(false)
    })

    it('should detect change from null to a value', () => {
      const existing = { value: null }
      const importData = { value: 'something' }

      const result = hasChanges(existing, importData, {
        value: 'value',
      })

      expect(result).toBe(true)
    })

    it('should detect change from value to null', () => {
      const existing = { value: 'something' }
      const importData = { value: null }

      const result = hasChanges(existing, importData, {
        value: 'value',
      })

      expect(result).toBe(true)
    })
  })

  describe('type coercion', () => {
    it('should not treat 0 and null as equal', () => {
      const existing = { count: 0 }
      const importData = { count: null }

      const result = hasChanges(existing, importData, {
        count: 'count',
      })

      expect(result).toBe(true)
    })

    it('should not treat empty string and null as equal', () => {
      const existing = { text: '' }
      const importData = { text: null }

      const result = hasChanges(existing, importData, {
        text: 'text',
      })

      expect(result).toBe(true)
    })

    it('should not treat false and null as equal', () => {
      const existing = { flag: false }
      const importData = { flag: null }

      const result = hasChanges(existing, importData, {
        flag: 'flag',
      })

      expect(result).toBe(true)
    })
  })

  describe('complex scenarios', () => {
    it('should handle mixed direct and function mappings', () => {
      const existing = { name: 'Test', total: 100 }
      const importData = { name: 'Test', price: 50, quantity: 2 }

      const result = hasChanges(existing, importData, {
        name: 'name',
        total: (data) => data.price * data.quantity,
      })

      expect(result).toBe(false)
    })

    it('should detect changes in complex mappings', () => {
      const existing = { name: 'Test', total: 100 }
      const importData = { name: 'Updated', price: 50, quantity: 3 }

      const result = hasChanges(existing, importData, {
        name: 'name',
        total: (data) => data.price * data.quantity,
      })

      expect(result).toBe(true)
    })

    it('should handle empty field map', () => {
      const existing = { name: 'Test' }
      const importData = { name: 'Different' }

      const result = hasChanges(existing, importData, {})

      expect(result).toBe(false)
    })

    it('should handle objects with different structures', () => {
      type DbRecord = { id: number; name: string; metadata?: string }
      type ImportRecord = { identifier: string; title: string; extra: number }

      const existing: DbRecord = { id: 1, name: 'Test' }
      const importData: ImportRecord = {
        identifier: '1',
        title: 'Test',
        extra: 999,
      }

      const result = hasChanges(existing, importData, {
        id: (data) => parseInt(data.identifier),
        name: 'title',
      })

      expect(result).toBe(false)
    })
  })
})
