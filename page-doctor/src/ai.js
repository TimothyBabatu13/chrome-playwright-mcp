import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const MODEL = process.env.MODEL || 'gemini-3.1-flash-lite';

const ai = new GoogleGenAI({});

function extractInteractionText(interaction) {
  if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }

  const chunks = [];
  for (const step of interaction.steps ?? []) {
    if (step.type !== 'model_output') continue;
    for (const part of step.content ?? []) {
      if (part.type === 'text' && part.text.trim()) {
        chunks.push(part.text.trim());
      }
    }
  }
  return chunks.join('');
}

export async function askAI(systemPrompt, userPrompt, options = {}) {
  const { temperature = 0.7, maxOutputTokens, schema, retries = 2 } = options;
  console.log(`Asking AI (${AI_PROVIDER} - ${MODEL})...`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (AI_PROVIDER === 'gemini') {
        const interaction = await ai.interactions.create({
          model: MODEL,
          input:
            'What is the best way to use the chrome mcp library with playwright to debug a web page?'
        });
        // const interactionText = extractInteractionText(response);
        // console.log(`AI response (attempt ${attempt}):`, interactionText);
        // return interactionText;
        console.log(interaction.output_text);
      }
    } catch (error) {
      console.error(`Error while asking AI (attempt ${attempt}):`, error);
      if (attempt === retries) {
        throw error;
      }
    }
  }
}

export async function testAI() {
  console.log('\nTesting AI connection...\n');

  try {
    const systemPrompt =
      'You are a helpful assistant helping users debug their code using the chrome mcp library and playwright.';
    const userPrompt =
      'What is the best way to use the chrome mcp library with playwright to debug a web page?';
    const response = await askAI();
    console.log('AI test response:', response);
  } catch (error) {
    console.error('AI test failed:', error);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await testAI();
}
