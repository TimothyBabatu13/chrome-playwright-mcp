import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

/**
 * Update a card's review schedule using a simple spaced-repetition model.
 * @param {Object} card - Current flashcard state.
 * @param {number} quality - Recall quality from 0 to 5.
 * @returns {Object} Updated card state.
 */
export function calculateNextReview(card, quality) {
  if (quality < 0 || quality > 5) {
    throw new Error(`Quality must be between 0 and 5, got ${quality}`);
  }

  // Fall back to the initial scheduling defaults.
  const easeFactor = card.easeFactor ?? DEFAULT_EASE_FACTOR;
  const interval = card.interval ?? 0;
  const repetitions = card.repetitions ?? 0;

  // Lower quality answers reduce the ease factor a bit.
  const adjustment = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor + adjustment);

  let newInterval;
  let newRepetitions;

  if (quality < 3) {
    // Poor recall restarts the learning sequence.
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Better recall extends the next review interval.
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) newInterval = 1;
    else if (newRepetitions === 2) newInterval = 6;
    else newInterval = Math.round(interval * newEaseFactor);
  }

  // Store the next review date on the updated card.
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    ...card,
    easeFactor: Number(newEaseFactor.toFixed(2)),
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview: nextReview.toISOString(),
    lastReviewed: new Date().toISOString()
  };
}

/**
 * Return the cards that are due for review now.
 * @param {Array<Object>} cards - Flashcards to inspect.
 * @param {Date} [now=new Date()] - Current time reference.
 * @returns {Array<Object>} Due cards.
 */
export function getCardsToReview(cards, now = new Date()) {
  return cards.filter(card => {
    if (!card.nextReview) return true;
    return new Date(card.nextReview) <= now;
  });
}

/**
 * Map a practice result to a recall quality score.
 * @param {boolean} wasCorrect - Whether the answer was correct.
 * @returns {number} Quality score used by the scheduler.
 */
export function qualityFromAnswer(wasCorrect) {
  return wasCorrect ? 5 : 2;
}

/**
 * Apply a practice session back onto the stored flashcard deck.
 * @param {string} deckPath - Path to the saved deck JSON.
 * @param {Array<Object>} results - Practice results from the session.
 * @returns {Promise<Array<Object>>} Updated deck.
 */
export async function applySession(deckPath, results) {
  const deck = JSON.parse(await fs.readFile(deckPath, 'utf-8'));

  // Only scored cards are updated; skipped cards stay unchanged.
  const scored = new Map(
    results.filter(r => !r.skipped).map(r => [r.question, Boolean(r.correct)])
  );

  const updated = deck.map(card => {
    if (!scored.has(card.question)) return card;
    return calculateNextReview(card, qualityFromAnswer(scored.get(card.question)));
  });

  await fs.writeFile(deckPath, JSON.stringify(updated, null, 2));

  const due = getCardsToReview(updated).length;
  console.log(`  Scheduling updated - ${due} of ${updated.length} cards due now`);

  return updated;
}

/**
 * Print the current review schedule for a deck.
 * @param {string} deckPath - Path to the saved deck JSON.
 * @returns {Promise<void>}
 */
export async function showSchedule(deckPath) {
  const deck = JSON.parse(await fs.readFile(deckPath, 'utf-8'));
  const due = getCardsToReview(deck);

  console.log(`\n  ${deckPath}`);
  console.log(`   ${deck.length} cards, ${due.length} due now\n`);

  const scheduled = deck
    .filter(card => card.nextReview)
    .sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview));

  if (scheduled.length === 0) {
    console.log('   No cards have been practised yet - every card is due.');
    console.log('   Run: npm run practice\n');
    return;
  }

  // Show the soonest reviews first.
  for (const card of scheduled.slice(0, 15)) {
    const when = new Date(card.nextReview);
    const days = Math.ceil((when - Date.now()) / (1000 * 60 * 60 * 24));
    const label = days <= 0 ? 'due now' : days === 1 ? 'tomorrow' : `in ${days} days`;
    const question = card.question.slice(0, 52);
    console.log(`   ${label.padEnd(12)} ${question}${card.question.length > 52 ? '…' : ''}`);
  }
  console.log('');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Allow running the schedule viewer directly.
  const explicitPath = process.argv[2];

  let deckPath = explicitPath;
  if (!deckPath) {
    // Fall back to the newest generated deck.
    const files = await fs.readdir('notes').catch(() => []);
    const decks = files.filter(f => f.endsWith('-flashcards.json')).sort();
    deckPath = decks.length ? `notes/${decks[decks.length - 1]}` : null;
  }

  if (!deckPath) {
    console.error(' No flashcard deck found. Run: npm run generate');
    process.exit(1);
  }

  await showSchedule(deckPath);
}
