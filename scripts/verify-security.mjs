#!/usr/bin/env node
/**
 * Echoverse Repository Security Verification Script
 * Verifies that:
 * 1. .gitignore properly excludes .env.local and secret files
 * 2. .env.local is not tracked or staged in Git
 * 3. .env.example contains only safe placeholders
 * 4. No NEXT_PUBLIC_GEMINI* exposure exists in source code
 * 5. The real GEMINI_API_KEY from .env.local does not appear in any source/doc file
 *
 * IMPORTANT: This script never prints secret values to stdout or logs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
let hasFailure = false;

function pass(msg) {
  console.log(`[PASS] ${msg}`);
}

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  hasFailure = true;
}

// 1. Check .gitignore exists and ignores .env.local
const gitignorePath = path.join(ROOT, '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  fail('.gitignore file is missing');
} else {
  const content = fs.readFileSync(gitignorePath, 'utf8');
  if (content.includes('.env.local') && content.includes('!.env.example')) {
    pass('.gitignore contains rules for .env.local and !.env.example');
  } else {
    fail('.gitignore is missing required .env.local / !.env.example rules');
  }
}

// 2. Check git check-ignore on .env.local
try {
  execSync('git check-ignore -q .env.local', { cwd: ROOT });
  pass('Git confirms .env.local is ignored');
} catch {
  fail('.env.local is NOT ignored by Git!');
}

// 3. Check git tracked/staged files for any .env files other than .env.example
try {
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  const badEnv = tracked.filter(
    (f) => (f === '.env' || f.startsWith('.env.')) && f !== '.env.example'
  );
  if (badEnv.length > 0) {
    fail(`Secret environment files are tracked by Git: ${badEnv.join(', ')}`);
  } else {
    pass('No secret .env files are tracked by Git');
  }
} catch {
  fail('Could not inspect git ls-files');
}

// 4. Verify .env.example contains only placeholders
const envExamplePath = path.join(ROOT, '.env.example');
if (!fs.existsSync(envExamplePath)) {
  fail('.env.example is missing');
} else {
  const exampleText = fs.readFileSync(envExamplePath, 'utf8');
  if (
    exampleText.includes('JAMENDO_CLIENT_ID=YOUR_JAMENDO_CLIENT_ID') &&
    exampleText.includes('GEMINI_API_KEY=YOUR_GEMINI_API_KEY') &&
    !exampleText.includes('AIza')
  ) {
    pass('.env.example contains safe placeholder values');
  } else {
    fail('.env.example may contain non-placeholder values');
  }
}

// 5. Scan repository files for accidental secret leakage or NEXT_PUBLIC_GEMINI
let secretGeminiKey = null;
const envLocalPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('GEMINI_API_KEY=')) {
      const val = line.slice('GEMINI_API_KEY='.length).trim();
      if (val && val !== 'YOUR_GEMINI_API_KEY' && val.length > 8) {
        secretGeminiKey = val;
      }
    }
  }
}

const IGNORE_DIRS = new Set(['.git', 'node_modules', '.next', 'out', 'build', 'coverage']);
const IGNORE_FILES = new Set(['.env.local', '.env', '.env.development', '.env.production']);

function walkFiles(dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walkFiles(path.join(dir, entry.name), result);
      }
    } else if (entry.isFile()) {
      if (!IGNORE_FILES.has(entry.name)) {
        result.push(path.join(dir, entry.name));
      }
    }
  }
  return result;
}

const filesToScan = walkFiles(ROOT);
let leakedFiles = [];
let publicEnvFiles = [];

for (const filePath of filesToScan) {
  const rel = path.relative(ROOT, filePath);
  // Skip binary files by extension
  if (/\.(png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|mp3|wav|ogg)$/i.test(rel)) {
    continue;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  if (secretGeminiKey && text.includes(secretGeminiKey)) {
    leakedFiles.push(rel);
  }
  if (/AIza[0-9A-Za-z\-_]{30,}/.test(text)) {
    if (!leakedFiles.includes(rel)) leakedFiles.push(rel);
  }
  if (rel !== 'scripts/verify-security.mjs' && text.includes('NEXT_PUBLIC_GEMINI')) {
    publicEnvFiles.push(rel);
  }
}

if (leakedFiles.length > 0) {
  fail(`Potential API key pattern found in: ${leakedFiles.join(', ')}`);
} else {
  pass('No API key values or patterns found in source/documentation files');
}

if (publicEnvFiles.length > 0) {
  fail(`Forbidden NEXT_PUBLIC_GEMINI exposure found in: ${publicEnvFiles.join(', ')}`);
} else {
  pass('No client-side NEXT_PUBLIC_GEMINI variable usage detected');
}

if (hasFailure) {
  console.error('\nSecurity verification FAILED. Do not commit or push until resolved.');
  process.exit(1);
} else {
  console.log('\nAll repository security checks PASSED.');
}
