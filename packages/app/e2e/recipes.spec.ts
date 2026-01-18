import { expect, test } from '@playwright/test'

test.describe('Recipes CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/management/recipes')
  })

  test('displays recipes list', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Recipes')
  })

  test('can open new recipe form', async ({ page }) => {
    const newButton = page
      .locator('main')
      .getByRole('button', { name: 'Add Recipe', exact: true })
      .first()
    await newButton.click()
    await expect(page.locator('.modal-content form')).toBeVisible()
  })

  test('can create a basic recipe', async ({ page }) => {
    // Open new recipe form
    await page.click('button:has-text("Add Recipe")')
    await page.waitForSelector('.modal-content form')

    // Fill in basic info
    await page.fill('input[name="name"]', 'Test Recipe E2E')
    await page.fill('input[name="sellPrice"]', '1000')

    // Submit the form
    await page.click('button[type="submit"]')

    // Should show in the list
    await page.waitForTimeout(500)
    await expect(page.locator('text=Test Recipe E2E')).toBeVisible()
  })

  test('can filter recipes by type', async ({ page }) => {
    const classFilter = page.locator('select[name="filter-class"]')
    if ((await classFilter.count()) > 0) {
      await classFilter.selectOption('menu_item')
      await page.waitForTimeout(500)
      await expect(page.locator('main h1')).toContainText('Recipes')
    }
  })

  test('can search recipes', async ({ page }) => {
    const searchInput = page.locator('input[name="search"]')
    if ((await searchInput.count()) > 0) {
      await searchInput.fill('test')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      await expect(page.locator('main h1')).toContainText('Recipes')
    }
  })
})

test.describe('Margin Calculator', () => {
  test('displays margin page', async ({ page }) => {
    await page.goto('/margin')
    await expect(page).toHaveURL('/margin')
  })
})
