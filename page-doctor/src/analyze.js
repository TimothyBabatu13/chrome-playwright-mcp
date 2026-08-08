import { askAI } from './ai.js';
import { formatBytes, rateAll } from './vitals.js';

const FINDINGS_SCHEMA = {};

const SYSTEM_PROMPT = `TODO: describe the AI's role and the rules above`;

function buildDigest(audit) {
  const lines = [];

  lines.push(`URL: ${audit.url}`);

  return lines.join('\n');
}

export async function analyzeAudit(audit) {
  console.log('Analyzing results...');

  console.log('Analysis not implemented yet...');

  return { verdict: '', findings: [] };
}
