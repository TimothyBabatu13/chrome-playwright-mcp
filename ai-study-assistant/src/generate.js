import fs from 'node:fs/promises';
import { exportAll } from './exporters.js';
import { generateFromFile } from './flashcards.js';

console.log('\n AI Study Assistant - Flashcard Generator\n');

/**
 * Find the latest notes file, generate flashcards, and export them.
 */
try {
  // Read the notes folder and keep only markdown note files.
  const files = await fs.readdir('notes');
  const noteFiles = files.filter(f => f.endsWith('.md') && !f.includes('-flashcards'));

  if (noteFiles.length === 0) {
    console.error(' No notes found. Run the collector first: npm run collect');
    process.exit(1);
  }

  // Pick the newest note by filename ordering.
  const latestFile = noteFiles.sort().reverse()[0];
  const filePath = `notes/${latestFile}`;

  console.log(` Using latest notes: ${latestFile}\n`);

  // Generate a starter set of flashcards from the selected notes file.
  const result = await generateFromFile(filePath, {
    count: 15,
    difficulty: 'intermediate',
    includeCode: true
  });

  console.log('\n Sample flashcards:\n');
  // Print a few examples so the user can sanity-check the output.
  result.flashcards.slice(0, 3).forEach((card, i) => {
    console.log(`${i + 1}. Q: ${card.question}`);
    console.log(`   A: ${card.answer}`);
    console.log(`   Tags: ${(card.tags ?? []).join(', ')}\n`);
  });

  if (result.flashcards.length > 3) {
    console.log(`... and ${result.flashcards.length - 3} more flashcards\n`);
  }

  // Export the generated set in the supported output formats.
  const basePath = result.outputPath.replace('.json', '');
  await exportAll(result.flashcards, basePath);

  console.log('\n All done! Ready to practice:\n');
  console.log('   npm run practice\n');
} catch (error) {
  console.error('\n Error:', error.message);
  process.exit(1);
}
