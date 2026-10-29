import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { readJsonFile, validateTest } from './package-checks.mjs';

const testsDir = path.join(process.cwd(), 'tests');
const errors = [];
const warnings = [];
let index = [];

if (!existsSync(testsDir)) {
  console.error('German CBT test validation failed:\n  - tests/ folder not found (it is not in git; copy it next to package.json)');
  process.exit(1);
}

// Same rule as src/services/loadTest.js: every tests/<folder>/config.json is a test.
const folders = readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(testsDir, entry.name, 'config.json')))
  .map((entry) => entry.name);

if (existsSync(path.join(testsDir, 'index.json'))) {
  try {
    index = readJsonFile(path.join(testsDir, 'index.json'));
  } catch (error) {
    errors.push(`tests/index.json could not be read (${error.message})`);
  }
}

const folderFor = new Map(folders.map((folder) => [folder.toLowerCase(), folder]));
for (const entry of index) {
  const folder = folderFor.get(String(entry?.id).toLowerCase());
  if (!folder) warnings.push(`tests/index.json lists "${entry?.id}" but tests/${entry?.id}/config.json does not exist (not shown in the app)`);
  else if (folder !== entry.id) warnings.push(`tests/index.json id "${entry.id}" differs in letter case from folder "${folder}"`);
}
folders
  .filter((folder) => !index.some((entry) => String(entry?.id).toLowerCase() === folder.toLowerCase()))
  .forEach((folder) => warnings.push(`tests/${folder} is not in tests/index.json (shown with its folder name, at the end of the list)`));

for (const folder of folders) {
  validateTest(testsDir, folder).forEach((error) => errors.push(`${folder}: ${error}`));
}

warnings.forEach((warning) => console.warn(`  ! ${warning}`));

if (errors.length) {
  console.error('German CBT test validation failed:');
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log(`German CBT test validation passed for ${folders.length} test(s).`);
