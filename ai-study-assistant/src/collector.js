import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { formatAsMarkdown } from './formatters.js';

export async function collectMaterial(url) {
  console.log(`\nCollecting study material from: ${url}\n`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false' // Allow running in non-headless mode for debugging.
  });

  let data;

  try {
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Wait for the DOM to be fully loaded, with a 60-second timeout.

    await page
      .waitForSelector('h1, h2, h3', { timeout: 15000 }) // Wait for headings to appear, with a 15-second timeout.
      .catch(() =>
        console.warn('No headings found on the page within 15 seconds, proceeding without them.')
      ); // Allow proceeding even if no headings are found.

    console.log('Page loaded, extracting content...');

    const codeSnippets = await page.$$eval('pre code', codes =>
      codes.map((code, index) => ({
        id: index + 1,
        language: code.className.replace('language-', '').replace('lang-', '') || 'javascript',
        code: code.textContent.trim()
      }))
    );

    console.log(`Found ${codeSnippets.length} code snippet(s).`);

    const content = await page.evaluate(() => {
      const sections = [];
      const headings = document.querySelectorAll('h1, h2, h3');

      headings.forEach(heading => {
        const nextElements = [];
        let current = heading.nextElementSibling;

        while (current && !current.matches('h1, h2, h3')) {
          if (current.matches('p')) {
            nextElements.push(current.textContent.trim());
          }
          current = current.nextElementSibling;
        }

        if (nextElements.length > 0) {
          sections.push({
            heading: heading.textContent.trim(),
            level: heading.tagName,
            content: nextElements.join('\n\n')
          });
        }
      });
      return sections;
    });

    console.log(`Extracted ${content.length} content section(s).`);

    data = {
      url,
      title: await page.title(),
      codeSnippets,
      content,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error(`Error navigating to ${url}:`, e.message);
  } finally {
    await browser.close();
  }

  if (data.content.length === 0 && data.codeSnippets.length === 0) {
    throw new Error(
      `No content or code snippets found at ${url}. Try another URL or adjust the selectors in the collector.`
    );
  }

  const markdown = formatAsMarkdown(data);

  const filename = `notes/collected-${Date.now()}.md`;
  await fs.mkdir('notes', { recursive: true });
  await fs.writeFile(filename, markdown);

  console.log(`\nStudy material saved to: ${filename}\n`);
  await fs.writeFile(filename.replace('.md', '.json'), JSON.stringify(data, null, 2));

  return data;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url =
    process.argv[2] ||
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise';

  console.log('---- AI Study Assistant - Material Collector ----');
  console.log(`\nCollecting study material from: ${url}\n`);

  try {
    await collectMaterial(url);
    console.log('\nCollection complete! You can now generate flashcards with: npm run generate\n');
  } catch (error) {
    console.error('\nError during collection:', error.message);
    process.exit(1);
  }
}
