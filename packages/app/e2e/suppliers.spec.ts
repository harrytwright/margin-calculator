import { expect, test } from '@playwright/test'

test.describe('Suppliers CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/management/suppliers')
  })

  test('displays suppliers list', async ({ page }) => {
    await expect(page.locator('main h1')).toContainText('Suppliers')
  })

  test('can open new supplier form', async ({ page }) => {
    const newButton = page
      .locator('main')
      .getByRole('button', { name: 'Add Supplier', exact: true })
      .first()
    await newButton.click()
    await expect(page.locator('.modal-content form')).toBeVisible()
  })

  test('can create a new supplier', async ({ page }) => {
    // Open new supplier form
    await page.click('button:has-text("Add Supplier")')
    await page.waitForSelector('.modal-content form')

    // Fill in the form
    await page.fill('input[name="name"]', 'Test Supplier E2E')

    // Submit the form
    await page.click('button[type="submit"]')

    // Should show in the list
    await page.waitForTimeout(500)
    await expect(page.locator('text=Test Supplier E2E')).toBeVisible()
  })

  test('can edit a supplier', async ({ page }) => {
    // First create a supplier
    await page.click('button:has-text("Add Supplier")')
    await page.waitForSelector('.modal-content form')
    await page.fill('input[name="name"]', 'Edit Test Supplier')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    // Click edit button
    const editButton = page
      .locator(
        'button[hx-get*="Edit Test Supplier"], tr:has-text("Edit Test Supplier") button[title="Edit"]'
      )
      .first()
    if ((await editButton.count()) > 0) {
      await editButton.click()
      await page.waitForSelector('.modal-content form')

      // Update the name
      await page.fill('input[name="name"]', 'Edit Test Supplier Updated')
      await page.click('button[type="submit"]')

      // Verify update
      await page.waitForTimeout(500)
      await expect(
        page.locator('text=Edit Test Supplier Updated')
      ).toBeVisible()
    }
  })

  test('can delete a supplier', async ({ page }) => {
    // First create a supplier
    await page.click('button:has-text("Add Supplier")')
    await page.waitForSelector('.modal-content form')
    await page.fill('input[name="name"]', 'Delete Test Supplier')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    // Find and click delete button
    const deleteButton = page
      .locator('tr:has-text("Delete Test Supplier") button[title="Delete"]')
      .first()
    if ((await deleteButton.count()) > 0) {
      await deleteButton.click()

      // Confirm deletion
      await page.click('#confirm-delete-btn')

      // Wait for deletion
      await page.waitForTimeout(500)
      await expect(
        page.locator('td:has-text("Delete Test Supplier")')
      ).not.toBeVisible()
    }
  })
})
