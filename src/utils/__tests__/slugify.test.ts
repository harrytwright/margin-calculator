import { slugifySync } from '../slugify'

describe('slugifySync', () => {
  describe('basic transformations', () => {
    it('should convert to lowercase', () => {
      expect(slugifySync('HELLO WORLD')).toBe('hello-world')
      expect(slugifySync('MixedCase')).toBe('mixedcase')
    })

    it('should replace spaces with hyphens', () => {
      expect(slugifySync('hello world')).toBe('hello-world')
      expect(slugifySync('multiple   spaces')).toBe('multiple-spaces')
    })

    it('should replace underscores with hyphens', () => {
      expect(slugifySync('hello_world')).toBe('hello-world')
      expect(slugifySync('multiple___underscores')).toBe('multiple-underscores')
    })

    it('should trim whitespace', () => {
      expect(slugifySync('  hello world  ')).toBe('hello-world')
      expect(slugifySync('\t\nhello\n\t')).toBe('hello')
    })
  })

  describe('special character handling', () => {
    it('should remove non-word characters', () => {
      expect(slugifySync('hello@world')).toBe('helloworld')
      expect(slugifySync('test!@#$%^&*()value')).toBe('testvalue')
      expect(slugifySync('dots.in.name')).toBe('dotsinname')
    })

    it('should preserve hyphens', () => {
      expect(slugifySync('pre-existing-hyphens')).toBe('pre-existing-hyphens')
      expect(slugifySync('test-123')).toBe('test-123')
    })

    it('should preserve alphanumeric characters', () => {
      expect(slugifySync('test123')).toBe('test123')
      expect(slugifySync('abc123xyz')).toBe('abc123xyz')
    })
  })

  describe('hyphen normalization', () => {
    it('should collapse multiple hyphens', () => {
      expect(slugifySync('hello--world')).toBe('hello-world')
      expect(slugifySync('test----value')).toBe('test-value')
      expect(slugifySync('many-------hyphens')).toBe('many-hyphens')
    })

    it('should remove leading hyphens', () => {
      expect(slugifySync('-hello')).toBe('hello')
      expect(slugifySync('---test')).toBe('test')
    })

    it('should remove trailing hyphens', () => {
      expect(slugifySync('hello-')).toBe('hello')
      expect(slugifySync('test---')).toBe('test')
    })

    it('should remove both leading and trailing hyphens', () => {
      expect(slugifySync('-hello-world-')).toBe('hello-world')
      expect(slugifySync('---test---')).toBe('test')
    })
  })

  describe('complex inputs', () => {
    it('should handle mixed spaces and underscores', () => {
      expect(slugifySync('hello world_test')).toBe('hello-world-test')
      expect(slugifySync('test_value  another')).toBe('test-value-another')
    })

    it('should handle supplier names', () => {
      expect(slugifySync('ASDA Grocery')).toBe('asda-grocery')
      expect(slugifySync('Tesco Extra')).toBe('tesco-extra')
      expect(slugifySync("Sainsbury's Local")).toBe('sainsburys-local')
    })

    it('should handle ingredient names', () => {
      expect(slugifySync('Pizza Dough')).toBe('pizza-dough')
      expect(slugifySync('Mozzarella Cheese (Shredded)')).toBe(
        'mozzarella-cheese-shredded'
      )
      expect(slugifySync('Extra Virgin Olive Oil')).toBe(
        'extra-virgin-olive-oil'
      )
    })

    it('should handle recipe names', () => {
      expect(slugifySync('Margherita Pizza')).toBe('margherita-pizza')
      expect(slugifySync('BBQ Chicken & Bacon')).toBe('bbq-chicken-bacon')
      expect(slugifySync('12" Classic Pepperoni')).toBe('12-classic-pepperoni')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(slugifySync('')).toBe('')
    })

    it('should handle string with only special characters', () => {
      expect(slugifySync('@#$%^&*()')).toBe('')
      expect(slugifySync('!!!')).toBe('')
    })

    it('should handle string with only whitespace', () => {
      expect(slugifySync('   ')).toBe('')
      expect(slugifySync('\t\n\r')).toBe('')
    })

    it('should handle string with only hyphens', () => {
      expect(slugifySync('---')).toBe('')
      expect(slugifySync('-')).toBe('')
    })

    it('should handle unicode characters', () => {
      expect(slugifySync('café')).toBe('caf')
      expect(slugifySync('naïve')).toBe('nave')
      expect(slugifySync('résumé')).toBe('rsum')
    })

    it('should handle numbers only', () => {
      expect(slugifySync('12345')).toBe('12345')
      expect(slugifySync('123-456')).toBe('123-456')
    })

    it('should handle single character', () => {
      expect(slugifySync('a')).toBe('a')
      expect(slugifySync('A')).toBe('a')
      expect(slugifySync('@')).toBe('')
    })
  })

  describe('real-world examples', () => {
    it('should slugify database import names', () => {
      expect(slugifySync('Base Pizza Template')).toBe('base-pizza-template')
      expect(slugifySync('10" Pizza Dough')).toBe('10-pizza-dough')
      expect(slugifySync('Pizza Sauce (Tomato)')).toBe('pizza-sauce-tomato')
    })

    it('should handle names with possessives', () => {
      expect(slugifySync("John's Recipe")).toBe('johns-recipe')
      expect(slugifySync("Chef's Special")).toBe('chefs-special')
    })

    it('should handle names with numbers and units', () => {
      expect(slugifySync('500g Flour')).toBe('500g-flour')
      expect(slugifySync('2.5kg Sugar')).toBe('25kg-sugar')
    })
  })
})
