import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { applySession } from './spaced-repetition.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Run an interactive flashcard practice session.
 * @param {string} flashcardsPath - Path to the generated flashcards file.
 * @returns {Promise<Object>} Session summary.
 */
export async function practiceFlashcards(flashcardsPath) {
  const data = await fs.readFile(flashcardsPath, 'utf-8');
  const flashcards = JSON.parse(data);

  console.log('\n AI Study Assistant - Practice Mode\n');
  console.log(` Loaded ${flashcards.length} flashcards`);
  console.log('━'.repeat(50));

  const answer = await rl.question('\nHow many cards do you want to practice? (Enter for all): ');
  const requested = parseInt(answer, 10);
  const cardCount = Number.isInteger(requested) && requested > 0 ? requested : flashcards.length;

  if (cardCount > flashcards.length) {
    console.log(`Only ${flashcards.length} cards available. Using all.`);
  }

  // Shuffle in place so each session feels different.
  const shuffled = [...flashcards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.length = Math.min(cardCount, shuffled.length);

  console.log(`\n Starting practice session with ${shuffled.length} cards!\n`);
  await sleep(1000);

  let correct = 0;
  let incorrect = 0;
  const results = [];

  for (let i = 0; i < shuffled.length; i++) {
    const card = shuffled[i];

    // Clear the screen so the current card stays focused.
    console.clear();
    console.log(`\n${'━'.repeat(50)}`);
    console.log(` Question ${i + 1}/${shuffled.length}`);
    console.log(`${'━'.repeat(50)}\n`);
    console.log(card.question);
    console.log('\n Think about your answer...\n');

    await rl.question('Press Enter to reveal the answer...');

    console.log(`\n${'─'.repeat(50)}`);
    console.log(' ANSWER:');
    console.log(`${'─'.repeat(50)}\n`);
    console.log(card.answer);
    console.log('\n');

    const response = await rl.question('Did you get it right? (y/n/s to skip): ');

    if (response.toLowerCase() === 's') {
      console.log('  Skipped');
      results.push({ ...card, skipped: true });
    } else if (response.toLowerCase() === 'y') {
      correct++;
      console.log(' Awesome! Keep it up!');
      results.push({ ...card, correct: true });
    } else {
      incorrect++;
      console.log(" No worries, you'll get it next time!");
      results.push({ ...card, correct: false });
    }

    // Small pause between cards to make the flow easier to follow.
    await sleep(800);
  }

  console.clear();
  console.log(`\n${'━'.repeat(50)}`);
  console.log(' SESSION COMPLETE!');
  console.log(`${'━'.repeat(50)}\n`);

  const percentage = Math.round((correct / (correct + incorrect)) * 100) || 0;

  // Summarize the session before saving it.
  console.log(` Correct:   ${correct}`);
  console.log(` Incorrect: ${incorrect}`);
  console.log(`  Skipped:   ${results.filter(r => r.skipped).length}`);
  console.log(`\n Score: ${percentage}%`);

  if (percentage >= 90) {
    console.log("\n Outstanding! You've mastered this!");
  } else if (percentage >= 70) {
    console.log('\n Great job! Almost there!');
  } else if (percentage >= 50) {
    console.log('\n Good effort! Keep reviewing!');
  } else {
    console.log("\n Keep practicing! You'll get better!");
  }

  const toReview = results.filter(r => !r.correct && !r.skipped);
  if (toReview.length > 0) {
    console.log(`\n Cards to review (${toReview.length}):\n`);
    toReview.forEach((card, i) => {
      console.log(
        `   ${i + 1}. ${card.question.slice(0, 60)}${card.question.length > 60 ? '...' : ''}`
      );
    });
  }

  // Save progress
  const progress = {
    date: new Date().toISOString(),
    flashcardsFile: flashcardsPath,
    total: shuffled.length,
    correct,
    incorrect,
    skipped: results.filter(r => r.skipped).length,
    score: percentage,
    cardsToReview: toReview.map(c => ({ question: c.question, tags: c.tags }))
  };

  // Persist the session so practice history is available later.
  await fs.mkdir('progress', { recursive: true });
  const progressFile = `progress/session-${Date.now()}.json`;
  await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));

  console.log(`\n💾 Progress saved to ${progressFile}`);

  try {
    await applySession(flashcardsPath, results);
  } catch (error) {
    console.log(`  Could not update review schedule: ${error.message}`);
  }

  console.log('\nKeep studying! \n');

  rl.close();
  return progress;
}

/**
 * Pause for a short delay.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>} Resolves after the delay.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Allow running this file directly from the command line.
  const filePath = process.argv[2] || (await getLatestFlashcards());

  if (!filePath) {
    console.error(' No flashcard files found. Generate some first with: npm run generate');
    process.exit(1);
  }

  try {
    await practiceFlashcards(filePath);
  } catch (error) {
    console.error('\n Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

/**
 * Find the most recent generated flashcards file in notes/.
 * @returns {Promise<string|null>} Latest flashcards path or null.
 */
async function getLatestFlashcards() {
  try {
    // Sort by filename so the newest export comes last.
    const files = await fs.readdir('notes');
    const flashcardFiles = files.filter(f => f.endsWith('-flashcards.json')).sort();

    if (flashcardFiles.length === 0) return null;

    return `notes/${flashcardFiles[flashcardFiles.length - 1]}`;
  } catch {
    return null;
  }
}
