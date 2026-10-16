import path from 'node:path';
import process from 'node:process';
import { readJsonFile, validateTest } from './package-checks.mjs';

const testsDir = path.join(process.cwd(), 'tests');
const errors = [];
let index = [];

try {
  index = readJsonFile(path.join(testsDir, 'index.json'));
} catch (error) {
  errors.push(`tests/index.json could not be read (${error.message})`);
}

for (const entry of index) {
  validateTest(testsDir, entry.id).forEach((error) => errors.push(`${entry.id}: ${error}`));
}

if (errors.length) {
  console.error('German CBT test validation failed:');
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log(`German CBT test validation passed for ${index.length} test(s).`);
