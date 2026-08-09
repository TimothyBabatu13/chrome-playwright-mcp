#!/usr/bin/env node
/**
 * Validate local prerequisites for the AI Study Assistant.
 */
import 'dotenv/config';

console.log('\nChecking setup...\n');

// Collect pass/fail status for each validation step.
const checks = [];

// Ensure Node.js runtime is new enough for modern APIs used in this project.
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (majorVersion >= 18) {
  console.log('Node.js version:', nodeVersion);
  checks.push(true);
} else {
  console.log('Node.js too old. Need 18 or newer, got:', nodeVersion);
  console.log('   Download from: https://nodejs.org/');
  checks.push(false);
}

// Verify browser automation dependency is available.
try {
  await import('playwright');
  console.log('Playwright installed');
  checks.push(true);
} catch {
  console.log('Playwright not installed. Run: npm install');
  checks.push(false);
}

// Verify OpenAI SDK exists for supported non-Gemini providers.
try {
  await import('openai/index.mjs');
  console.log('OpenAI package installed (used for non-Gemini providers)');
  checks.push(true);
} catch {
  console.log('OpenAI package not installed. Run: npm install');
  checks.push(false);
}

const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

// Map each hosted provider to its required API key env var.
const KEY_FOR_PROVIDER = {
  gemini: { env: 'GEMINI_API_KEY', url: 'https://aistudio.google.com/apikey' },
  openai: { env: 'OPENAI_API_KEY', url: 'https://platform.openai.com/api-keys' },
  anthropic: { env: 'ANTHROPIC_API_KEY', url: 'https://platform.claude.com/' },
  custom: { env: 'CUSTOM_API_KEY', url: "your provider's dashboard" }
};

console.log(`\n   Provider: ${provider}`);

if (provider === 'lmstudio' || provider === 'ollama' || provider === 'local') {
  // Local providers are checked via their /models endpoint.
  const url =
    provider === 'ollama'
      ? process.env.OLLAMA_URL || 'http://localhost:11434/v1'
      : process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';

  try {
    const response = await fetch(`${url}/models`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`Local AI server reachable at ${url}`);
    checks.push(true);
  } catch {
    console.log(`No local AI server at ${url}`);
    console.log(
      `   Start ${provider === 'ollama' ? 'Ollama (ollama serve)' : 'the LM Studio server'} and try again.`
    );
    checks.push(false);
  }
} else {
  // Hosted providers are checked via presence of the expected API key.
  const { env, url } = KEY_FOR_PROVIDER[provider] ?? KEY_FOR_PROVIDER.gemini;
  const key = process.env[env];

  if (key && !key.startsWith('your_')) {
    console.log(`${env} configured`);
    checks.push(true);
  } else {
    console.log(`   ${env} not set. Add it to your .env file`);
    console.log(`   Get a key at: ${url}`);
    console.log(`   (Run "cp .env.example .env" first if you haven't.)`);
    checks.push(false);
  }
}

// Confirm Chromium can launch, which also verifies browser binaries are installed.
try {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  await browser.close();
  console.log('Playwright browsers installed');
  checks.push(true);
} catch {
  console.log('Playwright browsers missing. Run: npx playwright install chromium');
  checks.push(false);
}

console.log(`\n${'─'.repeat(50)}`);
const passed = checks.filter(Boolean).length;
const total = checks.length;

// Exit non-zero when any prerequisite fails so CI/scripts can detect failure.
if (passed === total) {
  console.log("\n   Setup successful! You're ready!\n");
  process.exit(0);
} else {
  console.log(`\n  Setup incomplete: ${passed}/${total} checks passed`);
  console.log('Fix the issues above and run this script again.\n');
  process.exit(1);
}
