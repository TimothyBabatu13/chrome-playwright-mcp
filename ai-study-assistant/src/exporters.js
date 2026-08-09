import fs from 'node:fs/promises';

const tagsOf = card => (Array.isArray(card.tags) ? card.tags : []);

/**
 * Export flashcards as Anki-ready CSV.
 * @param {Array<Object>} flashcards - Cards to export.
 * @returns {string} CSV output.
 */
export function exportToAnki(flashcards) {
  let csv = 'Front,Back,Tags\n';

  flashcards.forEach(card => {
    // Quote fields so commas and quotes stay valid in CSV.
    const front = card.question.replace(/"/g, '""');
    const back = card.answer.replace(/"/g, '""');
    const tags = tagsOf(card)
      .map(t => t.replace(/\s+/g, '-'))
      .join(' ');
    csv += `"${front}","${back}","${tags}"\n`;
  });

  return csv;
}

/**
 * Export flashcards as Quizlet-compatible tab-separated text.
 * @param {Array<Object>} flashcards - Cards to export.
 * @returns {string} TSV output.
 */
export function exportToQuizlet(flashcards) {
  let text = '';

  flashcards.forEach(card => {
    // Collapse extra whitespace so each line stays clean.
    const question = card.question.replace(/\s+/g, ' ');
    const answer = card.answer.replace(/\s+/g, ' ');
    text += `${question}\t${answer}\n`;
  });

  return text;
}

/**
 * Export flashcards as a simple Markdown study sheet.
 * @param {Array<Object>} flashcards - Cards to export.
 * @returns {string} Markdown output.
 */
export function exportToMarkdown(flashcards) {
  let md = '# Flashcards\n\n';
  md += `Generated: ${new Date().toLocaleString()}\n\n`;
  md += `Total cards: ${flashcards.length}\n\n`;
  md += '---\n\n';

  flashcards.forEach((card, i) => {
    // Keep each card in a consistent, readable section.
    md += `## Card ${i + 1}\n\n`;
    md += `**Q:** ${card.question}\n\n`;
    md += `**A:** ${card.answer}\n\n`;
    if (tagsOf(card).length > 0) {
      md += `*Tags: ${tagsOf(card).join(', ')}*\n\n`;
    }
    md += '---\n\n';
  });

  return md;
}

/**
 * Export flashcards as a CSV format suitable for Notion import.
 * @param {Array<Object>} flashcards - Cards to export.
 * @returns {string} CSV output.
 */
export function exportToNotion(flashcards) {
  let csv = 'Question,Answer,Tags,Created\n';
  const now = new Date().toISOString().split('T')[0];

  flashcards.forEach(card => {
    // Add a stable created date for every row.
    const question = card.question.replace(/"/g, '""');
    const answer = card.answer.replace(/"/g, '""');
    const tags = tagsOf(card).join(', ');
    csv += `"${question}","${answer}","${tags}","${now}"\n`;
  });

  return csv;
}

/**
 * Serialize flashcards as pretty-printed JSON.
 * @param {Array<Object>} flashcards - Cards to export.
 * @returns {string} JSON output.
 */
export function exportToJSON(flashcards) {
  return JSON.stringify(flashcards, null, 2);
}

/**
 * Write every supported export format next to the source deck.
 * @param {Array<Object>} flashcards - Cards to export.
 * @param {string} basePath - Output path without extension.
 * @returns {Promise<void>}
 */
export async function exportAll(flashcards, basePath) {
  // Generate each format once and write it to disk.
  await fs.writeFile(`${basePath}.anki.csv`, exportToAnki(flashcards));
  await fs.writeFile(`${basePath}.quizlet.txt`, exportToQuizlet(flashcards));
  await fs.writeFile(`${basePath}.md`, exportToMarkdown(flashcards));
  await fs.writeFile(`${basePath}.notion.csv`, exportToNotion(flashcards));
  await fs.writeFile(`${basePath}.json`, exportToJSON(flashcards));

  console.log('\n Exported to all formats:');
  console.log('   - Anki (.anki.csv)');
  console.log('   - Quizlet (.quizlet.txt)');
  console.log('   - Markdown (.md)');
  console.log('   - Notion (.notion.csv)');
  console.log('   - JSON (.json)');
}
