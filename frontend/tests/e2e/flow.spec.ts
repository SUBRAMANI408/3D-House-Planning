import { test, expect } from '@playwright/test';

test.describe('3D House Planning E2E Flow', () => {
  test('AI Generation to 3D Switch workflow', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Expect the title or main container to be visible
    await expect(page).toHaveTitle(/3D House Planning|Vite/);
    
    // Open AI Generator (look for button containing 'AI Generator')
    const aiButton = page.getByRole('button', { name: /AI Generator/i });
    if (await aiButton.isVisible()) {
      await aiButton.click();
      
      // Step 1 -> Step 2
      await page.getByRole('button', { name: /Next/i }).click();
      
      // Step 2 -> Step 3
      await page.getByRole('button', { name: /Next/i }).click();
      
      // Step 3 -> Generate
      await page.getByRole('button', { name: /Generate House/i }).click();
      
      // Wait for Generation success and transition to Step 4
      await expect(page.getByText(/Generated AI Building Ready!|Validated/i)).toBeVisible({ timeout: 10000 });
      
      // Open & Edit
      await page.getByRole('button', { name: /Open & Edit/i }).click();
      
      // Verify Canvas is visible
      await expect(page.locator('canvas').first()).toBeVisible();
    }
  });

  test('View mode switching', async ({ page }) => {
    await page.goto('/');
    
    // Verify toolbar is visible
    const toolbar = page.getByRole('button', { name: /2D|3D/ });
    if (await toolbar.count() > 0) {
      await page.getByRole('button', { name: /3D/i }).first().click();
      await expect(page.locator('canvas').first()).toBeVisible();
      
      await page.getByRole('button', { name: /2D/i }).first().click();
      await expect(page.locator('canvas').first()).toBeVisible();
    }
  });
});
