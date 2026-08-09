import fs from 'node:fs/promises';
import { askAI } from './ai.js';

const FLASHCARD_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      answer: { type: 'string' },
      tags: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['question', 'answer', 'tags']
  }
};

function parseJSONArray(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse JSON:', error.message);
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end <= start) {
      throw new Error('No valid JSON array found in the text.');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

export async function generateFlashcards(content, options = {}) {
  const { count = 20, difficulty = 'intermediate', includeCode = true } = options;

  if (!content?.trim()) {
    throw new Error('No content provided for flashcard generation.');
  }

  const systemPrompt = `You are an expert educator creating study flashcards.

Rules:
1. Create exactly ${count} flashcards
2. Difficulty level: ${difficulty}
3. Each flashcard has: question, answer, and tags (an array of 2-4 lowercase topic keywords)
4. Focus on key concepts, not trivia
5. ${includeCode ? 'Include code examples where relevant' : 'No code examples'}
6. Questions should test understanding, not just memory
7. Answers should be concise but complete
8. Return ONLY a valid JSON array - no markdown fences, no explanation

Example output format:
[
  {
    "question": "What is a Promise in JavaScript?",
    "answer": "An object representing the eventual completion or failure of an asynchronous operation.",
    "tags": ["javascript", "async", "promises"]
  }
]`;

  const userPrompt = `Create flashcard from this content:\n\n${content.slice(0, 10000)}`;

  console.log(`Generating ${count} flashcards with AI...`);

  const response = await askAI(systemPrompt, userPrompt, {
    schema: FLASHCARD_SCHEMA,
    maxOutputTokens: Math.max(2048, count * 160)
  });

  const flashcards = parseJSONArray(response);

  if (!Array.isArray(flashcards) || flashcards.length !== count) {
    throw new Error(`AI did not return an array of flashcards. Expected ${count} flashcards.`);
  }

  const valid = flashcards
    .filter(card => card?.question && card.answer)
    .map(card => ({
      question: String(card.question).trim(),
      answer: String(card.answer).trim(),
      tags: Array.isArray(card.tags) ? card.tags.map(String) : []
    }));

  if (valid.length === 0) {
    throw new Error('No valid flashcards generated. Please check the content and try again.');
  }

  console.log(`Successfully generated ${valid.length} flashcards.`);

  return valid;
}

export async function generateFromFile(filePath, options = {}) {
  console.log(`Reading content from: ${filePath}`);

  const content = await fs.readFile(filePath, 'utf-8');

  const flashcards = await generateFlashcards(content, options);

  const outputPath = `${filePath.replace(/\.(md|json)$/, '')}-flashcards.json`;
  await fs.writeFile(outputPath, JSON.stringify(flashcards, null, 2));

  console.log(`Flashcards saved to: ${outputPath}`);

  return { flashcards, outputPath };
}
