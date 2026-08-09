import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/projects');
});

test('renders the page heading and intro', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Projects');
  await expect(page.getByText('Things I have built, shipped, and had to maintain.')).toBeVisible();
});

test('lists every project by default', async ({ page }) => {
  await expect(page.getByTestId('project-grid').getByTestId('project-card')).toHaveCount(6);
  await expect(page.getByTestId('result-count')).toHaveText('Showing 6 of 6 projects');
  await expect(page.getByTestId('empty-state')).toBeHidden();
});

test('starts with the All tag selected', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('a project card shows its title, year, tags and source link', async ({ page }) => {
  const card = page.getByTestId('project-card').filter({ hasText: 'Pixel Portfolio' });
  await expect(card.getByRole('heading', { level: 3 })).toHaveText('Pixel Portfolio');
  await expect(card.locator('.card-year')).toHaveText('2025');
  await expect(card.locator('.tag')).toHaveText(['React', 'TypeScript', 'CSS']);
  await expect(card.getByRole('link', { name: 'View source' })).toHaveAttribute(
    'href',
    'https://example.com/pixel-portfolio'
  );
});

test('every card links out to its source in a new tab', async ({ page }) => {
  const links = page.getByTestId('project-card').getByRole('link', { name: 'View source' });
  await expect(links).toHaveCount(6);
  await expect(links.first()).toHaveAttribute('target', '_blank');
});

test('filtering by a tag narrows the results', async ({ page }) => {
  await page.getByRole('button', { name: 'Node', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Node', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(page.getByTestId('result-count')).toHaveText('Showing 2 of 6 projects');
  await expect(page.getByTestId('project-card').getByRole('heading', { level: 3 })).toHaveText([
    'Snippet Vault',
    'Commit Coach'
  ]);
});

test('searching by title keeps only the matching project', async ({ page }) => {
  await page.getByTestId('project-search').fill('weather');

  await expect(page.getByTestId('result-count')).toHaveText('Showing 1 of 6 projects');
  await expect(page.getByTestId('project-card')).toHaveCount(1);
  await expect(page.getByTestId('project-card')).toContainText('Weather Now');
});

test('searching matches the description text too', async ({ page }) => {
  await page.getByTestId('project-search').fill('fuzzy search');

  await expect(page.getByTestId('project-card')).toHaveCount(1);
  await expect(page.getByTestId('project-card')).toContainText('Snippet Vault');
});

test('search is case insensitive', async ({ page }) => {
  await page.getByTestId('project-search').fill('TASK FLOW');

  await expect(page.getByTestId('project-card')).toHaveCount(1);
  await expect(page.getByTestId('project-card')).toContainText('Task Flow');
});

test('clearing the search restores the full list', async ({ page }) => {
  const search = page.getByTestId('project-search');
  await search.fill('weather');
  await expect(page.getByTestId('project-card')).toHaveCount(1);

  await search.fill('');
  await expect(page.getByTestId('project-card')).toHaveCount(6);
  await expect(page.getByTestId('result-count')).toHaveText('Showing 6 of 6 projects');
});

test('the tag filter and the search apply together', async ({ page }) => {
  await page.getByRole('button', { name: 'TypeScript', exact: true }).click();
  await page.getByTestId('project-search').fill('task');

  await expect(page.getByTestId('result-count')).toHaveText('Showing 1 of 6 projects');
  await expect(page.getByTestId('project-card')).toContainText('Task Flow');
});

test('shows the empty state when nothing matches', async ({ page }) => {
  await page.getByRole('button', { name: 'Node', exact: true }).click();
  await page.getByTestId('project-search').fill('weather');

  await expect(page.getByTestId('empty-state')).toHaveText('No projects match your filters.');
  await expect(page.getByTestId('project-grid')).toBeHidden();
  await expect(page.getByTestId('result-count')).toHaveText('Showing 0 of 6 projects');
});

test('switching back to All keeps the active search term', async ({ page }) => {
  await page.getByRole('button', { name: 'Node', exact: true }).click();
  await page.getByTestId('project-search').fill('weather');
  await expect(page.getByTestId('empty-state')).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();

  await expect(page.getByTestId('project-search')).toHaveValue('weather');
  await expect(page.getByTestId('project-card')).toHaveCount(1);
  await expect(page.getByTestId('project-card')).toContainText('Weather Now');
});
