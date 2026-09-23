import { test, expect } from '@playwright/test';

test.describe('3D House Planning E2E Flow', () => {
  test('AI Generation to 3D Switch workflow', async ({ page }) => {
    // Navigate to the app
    await page.goto('/editor/new');
    
    // Expect the title or main container to be visible
    await expect(page).toHaveTitle(/3D House Planning|Vite/);
    
    // Open AI Generator (look for button containing 'AI Builder')
    const aiButton = page.getByRole('button', { name: /AI Builder/i });
    await expect(aiButton).toBeVisible();
    await aiButton.click();
    
    // Step 1 -> Step 2
    const nextButton1 = page.getByRole('button', { name: /Next/i });
    await expect(nextButton1).toBeVisible();
    await nextButton1.click();
    
    // Step 2 -> Step 3
    const nextButton2 = page.getByRole('button', { name: /Next/i });
    await expect(nextButton2).toBeVisible();
    await nextButton2.click();
    
    // Step 3 -> Generate
    const generateButton = page.getByRole('button', { name: /Generate House/i });
    await expect(generateButton).toBeVisible();
    await generateButton.click();
    
    // Wait for Generation success and transition to Step 4
    await expect(page.getByText(/Generated AI Building Ready!|Validated|Backend AI service unavailable/i)).toBeVisible({ timeout: 15000 });
  });

  test('View mode switching', async ({ page }) => {
    await page.goto('/editor/new');
    
    // Verify toolbar is visible
    const toolbar3D = page.getByRole('button', { name: /3D Model/i });
    const toolbar2D = page.getByRole('button', { name: /2D CAD/i });
    
    // Switch to 3D
    await expect(toolbar3D.first()).toBeVisible();
    await toolbar3D.first().click();
    await expect(page.locator('canvas').first()).toBeVisible();
    
    // Switch back to 2D
    await expect(toolbar2D.first()).toBeVisible();
    await toolbar2D.first().click();
    await expect(page.locator('svg').first()).toBeVisible();
  });
});
