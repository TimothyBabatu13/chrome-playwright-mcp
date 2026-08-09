# Portfolio website

React 19 + TypeScript + Vite + React Router. Dev server runs on [http://localhost:5173](http://localhost:5173).

## Pages

- `/` — hero with h1 "Hi, I am UT", career stats region, three featured project cards
- `/projects` — search box, tag filter chips, result count, project grid, empty state
- `/contact` — name / email / message form with validation and a 900ms fake submit
- anything else — 404 page

## Rules for writing Playwright tests

- Put specs in `tests/` named `<area>.spec.ts`.
- Use `baseURL`-relative paths: `page.goto('/projects')`, never a hardcoded host.
- Prefer `getByRole` and `getByLabel`. Fall back to `getByTestId` only when no accessible name exists.
- Never use `getByText` for anything that appears more than once on the page.
- Never use `page.waitForTimeout`. Use web-first assertions and let them retry.
- Always `await` every assertion.
- One behaviour per test. The test title describes the behaviour, not the mechanics.
- Do not write comments in test files.

## Stable test ids

`brand`, `theme-toggle`, `hero-tagline`, `featured-grid`, `project-search`,
`project-grid`, `project-card`, `result-count`, `empty-state`, `contact-form`,
`submit-button`, `error-name`, `error-email`, `error-message`, `success-message`
