import 'dotenv/config';
import { fileURLToPath } from 'node:url';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const MODEL = process.env.MODEL || 'gemini-3.1-flash-lite';

function extractInteractionText(interaction) {
  return null;
}

export async function askAI(systemPrompt, userPrompt) {
  console.log(`Asking AI (${AI_PROVIDER} - ${MODEL})...`);

  console.log('AI integration not implemented yet..');
  return null;
}

export async function testAI() {
  console.log('\nTesting AI connection...\n');

  console.log('Test function not implemented yet...');
  return false;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await testAI();
}
