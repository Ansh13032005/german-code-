const SUPPORTED_SCHEMA_VERSION = 1;
// index.json is optional: without it (e.g. a fresh copy on another laptop) the app still builds.
const indexModules = import.meta.glob('../../tests/index.json', { eager: true, import: 'default' });
const jsonModules = import.meta.glob('../../tests/*/**/*.json');
const assetModules = import.meta.glob([
  '../../tests/*/listening/**/*.{mp3,wav,ogg,m4a,mpeg}',
  '../../tests/*/assets/**/*.{png,jpg,jpeg,webp,gif,svg}'
], { query: '?url', import: 'default' });

// Paths typed in index.json / questions.json may differ in letter case or Unicode form from the
// real file names. Windows forgives that, Vite's glob keys do not, so look them up loosely too.
const looseKey = (key) => String(key).normalize('NFC').toLowerCase();
const looseIndex = (modules) => new Map(Object.keys(modules).map((key) => [looseKey(key), key]));
const looseJsonKeys = looseIndex(jsonModules);
const looseAssetKeys = looseIndex(assetModules);

function lookup(modules, looseKeys, key) {
  return modules[key] || modules[looseKeys.get(looseKey(key))];
}

// Every tests/<folder>/config.json is a test. index.json sets the order and display names;
// folders missing from it are still listed, and entries without a folder are skipped.
function buildTestsIndex() {
  const folders = Object.keys(jsonModules)
    .map((key) => key.match(/^\.\.\/\.\.\/tests\/([^/]+)\/config\.json$/)?.[1])
    .filter(Boolean);
  const folderFor = new Map(folders.map((folder) => [looseKey(folder), folder]));
  const declared = Object.values(indexModules)[0];
  const listed = [];
  const seen = new Set();

  (Array.isArray(declared) ? declared : []).forEach((entry) => {
    const folder = folderFor.get(looseKey(entry?.id));
    if (!folder) {
      console.warn(`tests/index.json: no tests/${entry?.id}/config.json found, skipping this entry.`);
      return;
    }
    if (seen.has(folder)) return;
    seen.add(folder);
    listed.push({ ...entry, id: folder, name: entry.name || folder });
  });

  folders
    .filter((folder) => !seen.has(folder))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .forEach((folder) => listed.push({ id: folder, name: folder }));

  return listed;
}

export const testsIndex = buildTestsIndex();

function moduleKey(testId, relativePath) {
  return `../../tests/${testId}/${String(relativePath).replace(/^\.\//, '').replace(/^\//, '')}`;
}

function hasJsonFor(testId, relativePath) {
  return Boolean(lookup(jsonModules, looseJsonKeys, moduleKey(testId, relativePath)));
}

async function jsonFor(testId, relativePath) {
  const importer = lookup(jsonModules, looseJsonKeys, moduleKey(testId, relativePath));
  if (!importer) throw new Error(`Missing test file: tests/${testId}/${relativePath}`);
  const module = await importer();
  const data = module.default ?? module;
  const version = data?.schemaVersion ?? SUPPORTED_SCHEMA_VERSION;
  if (version !== SUPPORTED_SCHEMA_VERSION) throw new Error(`Unsupported schemaVersion ${version} in ${relativePath}`);
  return data;
}

async function assetFor(testId, relativePath) {
  if (!relativePath || /^(https?:|data:|blob:)/i.test(relativePath)) return relativePath;
  const normalized = String(relativePath).replace(/^\.\//, '').replace(/^\//, '').replace(/^\.\.\//, '');
  const importer = lookup(assetModules, looseAssetKeys, moduleKey(testId, normalized));
  if (!importer) {
    console.warn(`Asset not found: tests/${testId}/${normalized} (audio must be under listening/, images under assets/)`);
    return relativePath;
  }
  const value = await importer();
  return value.default ?? value;
}

async function resolveAssets(testId, value) {
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveAssets(testId, item)));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if ((key === 'image' || key === 'audio' || key === 'src') && typeof nested === 'string') output[key] = await assetFor(testId, nested);
    else output[key] = await resolveAssets(testId, nested);
  }
  return output;
}

function scoped(testId, exam) {
  return { ...exam, id: `${testId}-${exam.id}` };
}

const KNOWN_MODULES = ['listening', 'reading', 'grammar', 'writing'];

export async function loadTest(testId) {
  const config = await jsonFor(testId, 'config.json');
  const declaredSections = Array.isArray(config.sections) ? config.sections : ['listening', 'reading', 'writing'];
  const hasGrammar = declaredSections.includes('grammar') && hasJsonFor(testId, 'grammar/questions.json') && hasJsonFor(testId, 'grammar/answers.json');
  const hasListening = declaredSections.includes('listening') && hasJsonFor(testId, 'listening/questions.json') && hasJsonFor(testId, 'listening/answers.json');
  const hasReading = declaredSections.includes('reading') && hasJsonFor(testId, 'reading/questions.json') && hasJsonFor(testId, 'reading/answers.json');
  const hasWriting = declaredSections.includes('writing') && hasJsonFor(testId, 'writing/tasks.json');

  const modules = KNOWN_MODULES.filter((id) => {
    if (id === 'grammar') return hasGrammar;
    if (id === 'listening') return hasListening;
    if (id === 'reading') return hasReading;
    if (id === 'writing') return hasWriting;
    return false;
  });

  const [listeningRaw, listeningAnswersRaw, readingRaw, readingAnswersRaw, writingRaw, writingAnswersRaw, grammarRaw, grammarAnswersRaw] = await Promise.all([
    hasListening ? jsonFor(testId, 'listening/questions.json') : Promise.resolve(null),
    hasListening ? jsonFor(testId, 'listening/answers.json') : Promise.resolve(null),
    hasReading ? jsonFor(testId, 'reading/questions.json') : Promise.resolve(null),
    hasReading ? jsonFor(testId, 'reading/answers.json') : Promise.resolve(null),
    hasWriting ? jsonFor(testId, 'writing/tasks.json') : Promise.resolve(null),
    hasWriting && hasJsonFor(testId, 'writing/answers.json') ? jsonFor(testId, 'writing/answers.json') : Promise.resolve(null),
    hasGrammar ? jsonFor(testId, 'grammar/questions.json') : Promise.resolve(null),
    hasGrammar ? jsonFor(testId, 'grammar/answers.json') : Promise.resolve(null)
  ]);

  // The folder name is the test's identity (saved progress keys, report names). config.id is
  // missing in some tests and easily left unchanged when a folder is copied for a new test.
  const bundle = { ...config, id: testId, config, modules };

  if (hasListening && listeningRaw) {
    const listeningResolved = await resolveAssets(testId, listeningRaw);
    const hasGlobalAudio = config.audio !== null && listeningResolved.audioMode !== 'perTask';
    const audio = hasGlobalAudio ? await assetFor(testId, config.audio || 'listening/audio.mp3') : null;
    const audioMode = listeningResolved.audioMode || (hasGlobalAudio ? 'single' : 'perTask');

    bundle.listening = scoped(testId, {
      ...listeningResolved,
      durationMinutes: listeningResolved.durationMinutes ?? config.durations?.listening,
      readingTimeSeconds: listeningResolved.readingTimeSeconds ?? config.readingTimeSeconds,
      audio,
      audioMode,
      answerKey: listeningAnswersRaw?.answers || {}
    });
  }

  if (hasReading && readingRaw) {
    const readingResolved = await resolveAssets(testId, readingRaw);
    bundle.reading = scoped(testId, {
      ...readingResolved,
      durationMinutes: readingResolved.durationMinutes ?? config.durations?.reading,
      answerKey: readingAnswersRaw?.answers || {}
    });
  }

  if (hasWriting && writingRaw) {
    const writingResolved = await resolveAssets(testId, writingRaw);
    bundle.writing = scoped(testId, {
      ...writingResolved,
      durationMinutes: writingResolved.durationMinutes ?? config.durations?.writing,
      answerKey: writingAnswersRaw?.answers || {},
      manualReview: writingAnswersRaw?.manualReview || null
    });
  }

  if (hasGrammar && grammarRaw) {
    const grammarResolved = await resolveAssets(testId, grammarRaw);
    const grammarAnswerKey = { ...(grammarAnswersRaw?.answers || {}) };
    if (grammarAnswersRaw?.wordSearch?.question && grammarAnswersRaw?.wordSearch?.acceptedAnswers) {
      grammarAnswerKey[String(grammarAnswersRaw.wordSearch.question)] = grammarAnswersRaw.wordSearch.acceptedAnswers;
    }
    bundle.grammar = scoped(testId, {
      ...grammarResolved,
      durationMinutes: grammarResolved.durationMinutes ?? config.durations?.grammar,
      answerKey: grammarAnswerKey,
      wordSearchConfig: grammarAnswersRaw?.wordSearch || null
    });
  }

  return bundle;
}
