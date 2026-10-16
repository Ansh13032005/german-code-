import testsIndex from '../../tests/index.json';

const SUPPORTED_SCHEMA_VERSION = 1;
const jsonModules = import.meta.glob('../../tests/*/**/*.json');
const assetModules = import.meta.glob([
  '../../tests/*/listening/**/*.{mp3,wav,ogg}',
  '../../tests/*/assets/**/*.{png,jpg,jpeg,webp,gif,svg}'
], { query: '?url', import: 'default' });

export { testsIndex };

function moduleKey(testId, relativePath) {
  return `../../tests/${testId}/${String(relativePath).replace(/^\.\//, '').replace(/^\//, '')}`;
}

function hasJsonFor(testId, relativePath) {
  return Boolean(jsonModules[moduleKey(testId, relativePath)]);
}

async function jsonFor(testId, relativePath) {
  const importer = jsonModules[moduleKey(testId, relativePath)];
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
  const importer = assetModules[moduleKey(testId, normalized)];
  if (!importer) return relativePath;
  const value = await importer();
  return value.default ?? value;
}

async function resolveAssets(testId, value) {
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveAssets(testId, item)));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if ((key === 'image' || key === 'audio') && typeof nested === 'string') output[key] = await assetFor(testId, nested);
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

  const bundle = { ...config, config, modules };

  if (hasListening && listeningRaw) {
    const listeningResolved = await resolveAssets(testId, listeningRaw);
    const hasGlobalAudio = config.audio !== null;
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
    bundle.reading = scoped(testId, {
      ...readingRaw,
      durationMinutes: readingRaw.durationMinutes ?? config.durations?.reading,
      answerKey: readingAnswersRaw?.answers || {}
    });
  }

  if (hasWriting && writingRaw) {
    bundle.writing = scoped(testId, {
      ...writingRaw,
      durationMinutes: writingRaw.durationMinutes ?? config.durations?.writing,
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
