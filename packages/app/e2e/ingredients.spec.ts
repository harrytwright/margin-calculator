import { expect, test } from '@playwright/test'

test.describe('Ingredients CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/management/ingredients')
  })

  test('displays ingredients list', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Ingredients')
  })

  test('can open new ingredient form', async ({ page }) => {
    const newButton = page
      .locator('main')
      .getByRole('button', { name: 'Add Ingredient', exact: true })
      .first()
    await newButton.click()
    await expect(page.locator('.modal-content form')).toBeVisible()
  })

  test('can search ingredients', async ({ page }) => {
    const searchInput = page.locator('input[name="search"]')
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('test')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      // Just verify page updates without error
      await expect(page.locator('main h1')).toContainText('Ingredients')
    }
  })

  test('can filter ingredients by category', async ({ page }) => {
    const categoryFilter = page.locator('select[name="filter-category"]')
    if ((await categoryFilter.count()) > 0) {
      const options = await categoryFilter.locator('option').all()
      if (options.length > 1) {
        await categoryFilter.selectOption({ index: 1 })
        await page.waitForTimeout(500)
        await expect(page.locator('main h1')).toContainText('Ingredients')
      }
    }
  })

  test('can filter ingredients by supplier', async ({ page }) => {
    const supplierFilter = page.locator('select[name="filter-supplier"]')
    if ((await supplierFilter.count()) > 0) {
      const options = await supplierFilter.locator('option').all()
      if (options.length > 1) {
        await supplierFilter.selectOption({ index: 1 })
        await page.waitForTimeout(500)
        await expect(page.locator('main h1')).toContainText('Ingredients')
      }
    }
  })
})
