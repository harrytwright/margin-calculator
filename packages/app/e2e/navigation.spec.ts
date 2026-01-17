import { expect, test } from '@playwright/test'

test.describe('Navigation', () => {
  test('redirects root to management/suppliers', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/management/suppliers')
    await expect(page.locator('main h1')).toContainText('Suppliers')
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/management/suppliers')

    // Navigate to Ingredients
    await page.click('a[href="/management/ingredients"]')
    await expect(page).toHaveURL('/management/ingredients')
    await expect(page.locator('main h1')).toContainText('Ingredients')

    // Navigate to Recipes
    await page.click('a[href="/management/recipes"]')
    await expect(page).toHaveURL('/management/recipes')
    await expect(page.locator('main h1')).toContainText('Recipes')

    // Navigate to Margin
    await page.click('a[href="/margin"]')
    await expect(page).toHaveURL('/margin')

    // Navigate back to Suppliers
    await page.click('a[href="/management/suppliers"]')
    await expect(page).toHaveURL('/management/suppliers')
    await expect(page.locator('main h1')).toContainText('Suppliers')
  })

  test('legacy routes redirect to new routes', async ({ page }) => {
    // Test legacy supplier route
    await page.goto('/suppliers')
    await expect(page).toHaveURL('/management/suppliers')

    // Test legacy ingredients route
    await page.goto('/ingredients')
    await expect(page).toHaveURL('/management/ingredients')

    // Test legacy recipes route
    await page.goto('/recipes')
    await expect(page).toHaveURL('/management/recipes')

    // Test legacy margins route
    await page.goto('/margins')
    await expect(page).toHaveURL('/margin')
  })

  test('metrics endpoint returns prometheus format', async ({ request }) => {
    const response = await request.get('/metrics')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')

    const body = await response.text()
    expect(body).toContain('menubook_http_requests_total')
  })
})
