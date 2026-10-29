import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { acceptedAnswersFor, normalize } from '../src/utils/report.js';
import { NO_INFORMATION_VALUE } from '../src/utils/constants.js';

const INVISIBLE_CHARACTER = /[­​-‍⁠﻿]/;
// UTF-8 umlauts re-read as Windows-1252/Latin-1, e.g. "Ã¤" (ä), "Ã¼" (ü), "ÃŸ" (ß), "Ã–" (Ö).
const MOJIBAKE = /[ÃÂ][\u0080-¿ŒœŸ–—‘-„]/;
const CHOICE_OPTION_FIELDS = { choice: 'options', imageChoice: 'options', sourceChoice: 'sources' };

// Notepad's "UTF-8 with BOM" starts the file with U+FEFF; Vite strips it on import, so do the same.
export function parseJsonText(text) {
  return JSON.parse(String(text).replace(/^﻿/, ''));
}

export function readJsonFile(file) {
  return parseJsonText(readFileSync(file, 'utf8'));
}

// Every string in a parsed JSON file must be clean UTF-8 German text.
export function textProblems(value, where = '') {
  const problems = [];
  const visit = (node, at) => {
    if (typeof node === 'string') {
      if (node.includes('�')) problems.push(`${at}: contains "�" - the file was not saved as UTF-8 (e.g. ANSI)`);
      else if (MOJIBAKE.test(node)) problems.push(`${at}: contains garbled umlauts such as "Ã¤" - text was re-saved with the wrong encoding`);
      if (node !== node.normalize('NFC')) problems.push(`${at}: contains decomposed letters (NFD) - retype the umlauts`);
      const invisible = node.match(INVISIBLE_CHARACTER);
      if (invisible) problems.push(`${at}: contains invisible character U+${invisible[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
      return;
    }
    if (Array.isArray(node)) node.forEach((item, index) => visit(item, `${at}[${index}]`));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([key, item]) => visit(item, at ? `${at}.${key}` : key));
  };
  visit(value, where);
  return problems;
}

// Question numbers rendered by the exam screens, with what a valid answer looks like for each.
export function collectQuestions(data) {
  const questions = new Map();
  const problems = [];
  const add = (q, info) => {
    if (q == null) return;
    const key = String(q);
    if (questions.has(key)) problems.push(`Question ${key} is used twice (${questions.get(key).where} / ${info.where})`);
    questions.set(key, info);
  };

  (data?.sections || []).forEach((section, sectionIndex) => {
    const where = section.title || `section ${sectionIndex + 1}`;
    (section.blocks || []).forEach((block) => {
      if (block.type === 'conversationOrdering') {
        const items = block.items || [];
        if (items.some((item) => item.q != null)) {
          const group = { size: items.length, examplePositions: items.filter((item) => item.example).map((item) => String(item.position)) };
          items.forEach((item) => add(item.q, { kind: 'ordering', where, group }));
        } else {
          add(block.q, { kind: 'sequence', where, itemIds: items.map((item) => item.id) });
        }
        return;
      }
      if (block.type === 'dialogueWordBank') {
        const group = { options: block.wordBank || [] };
        (block.lines || []).forEach((line) => add(line.q, { kind: 'wordBank', where, group }));
        return;
      }
      if (block.type === 'matching') {
        const group = { options: (block.rightItems || []).map((item) => item.id) };
        (block.leftItems || []).forEach((item) => add(item.q, { kind: 'matching', where, group }));
        return;
      }
      if (block.type === 'crossword') {
        (block.entries || []).forEach((entry) => add(entry.q, { kind: 'text', where }));
        return;
      }
      if (block.type === 'sentenceGaps') {
        (block.sentences || []).forEach((sentence) => (sentence.segments || []).forEach((segment) => add(segment.q, { kind: 'text', where })));
        return;
      }
      if (block.type === 'imageOrderingDrop') {
        [...(block.images || []), ...(block.slots || [])].forEach((item) => add(item.q, { kind: 'text', where }));
        return;
      }
      if (block.type === 'imageDialogueRow') {
        (block.rows || []).forEach((row) => (row.lines || []).forEach((line) => add(line.q, { kind: 'text', where })));
        return;
      }
      if (String(block.type || '').startsWith('example')) return;
      if (CHOICE_OPTION_FIELDS[block.type]) {
        add(block.q, { kind: 'choice', where, options: Object.keys(block[CHOICE_OPTION_FIELDS[block.type]] || {}) });
        return;
      }
      if (block.type === 'noticeChoice') {
        add(block.q, { kind: 'choice', where, options: ['richtig', 'falsch'] });
        return;
      }
      add(block.q, { kind: 'text', where });
      (block.items || []).forEach((item) => add(item.q, { kind: 'text', where }));
      (block.questions || []).forEach((item) => add(item.q, { kind: 'text', where }));
    });
  });

  (data?.tasks || []).forEach((task) => {
    const where = task.title || task.id || 'writing task';
    (task.rows || []).forEach((row) => add(row.q, row.inputType === 'choice' ? { kind: 'choice', where, options: row.options || [] } : { kind: 'text', where }));
    (task.items || []).forEach((item) => add(item.q, { kind: 'text', where }));
  });

  return { questions, problems };
}

// Checks that answers.json lines up with questions.json the way src/utils/report.js grades it.
export function answerKeyProblems(questionsData, answerKey = {}) {
  const { questions, problems } = collectQuestions(questionsData);
  const keys = Object.keys(answerKey).sort((a, b) => Number(a) - Number(b));
  questions.forEach((info, q) => {
    if (!(q in answerKey)) problems.push(`Question ${q} (${info.where}) has no answer-key entry`);
  });

  const usedAnswers = new Map();
  for (const q of keys) {
    const info = questions.get(q);
    const entry = answerKey[q];
    if (!info) problems.push(`Answer key ${q} has no matching question`);

    if (Array.isArray(entry?.correctOrder)) {
      const expected = [...(info?.itemIds || [])].sort().join('|');
      if (info?.kind !== 'sequence') problems.push(`Answer key ${q}: correctOrder is only valid for a whole-dialogue ordering question`);
      else if ([...entry.correctOrder].sort().join('|') !== expected) problems.push(`Answer key ${q}: correctOrder must list every dialogue line exactly once`);
      continue;
    }
    const understood = ['string', 'number'].includes(typeof entry) || Array.isArray(entry) || Array.isArray(entry?.acceptedAnswers);
    if (!understood) {
      problems.push(`Answer key ${q}: format not understood by the grader, so it would always be marked wrong`);
      continue;
    }

    const accepted = acceptedAnswersFor(entry);
    if (!accepted.length || accepted.some((answer) => answer !== NO_INFORMATION_VALUE && !normalize(answer))) {
      problems.push(`Answer key ${q}: empty answer, so every response would be marked wrong`);
      continue;
    }
    if (!info) continue;

    const options = info.options || info.group?.options;
    // Extra spelling variants are fine as long as at least one accepted answer is a selectable option.
    if (options) {
      const normalizedOptions = options.map(normalize);
      if (!accepted.some((answer) => normalizedOptions.includes(normalize(answer)))) {
        accepted.forEach((answer) => problems.push(`Answer key ${q}: "${answer}" is not one of the options (${options.join(', ')})`));
      }
    }
    if (info.kind === 'ordering') {
      accepted.forEach((answer) => {
        const position = Number(answer);
        if (!Number.isInteger(position) || position < 1 || position > info.group.size) {
          problems.push(`Answer key ${q}: position "${answer}" must be a whole number from 1 to ${info.group.size}`);
        } else if (info.group.examplePositions.includes(String(position))) {
          problems.push(`Answer key ${q}: position ${position} is already taken by the example line`);
        }
      });
    }
    // In word-bank, matching and ordering questions each option can only be placed once.
    if (info.group && accepted.length === 1) {
      const used = usedAnswers.get(info.group) || new Map();
      const answer = normalize(accepted[0]);
      if (used.has(answer)) problems.push(`Answer key ${q}: "${accepted[0]}" is also the answer to question ${used.get(answer)}, but it can only be used once`);
      used.set(answer, q);
      usedAnswers.set(info.group, used);
    }
  }

  usedAnswers.forEach((used, group) => {
    if (!group.size) return;
    const positions = new Set([...used.keys(), ...group.examplePositions]);
    const missing = Array.from({ length: group.size }, (_, index) => String(index + 1)).filter((position) => !positions.has(position));
    if (missing.length) problems.push(`Dialogue ordering: no line has position ${missing.join(', ')}`);
  });

  return problems;
}

// Same folders and extensions as the asset glob in src/services/loadTest.js.
const LOADABLE_ASSET = /^(listening\/.+\.(mp3|wav|ogg|m4a|mpeg)|assets\/.+\.(png|jpg|jpeg|webp|gif|svg))$/i;

function collectAssets(value, refs = []) {
  if (Array.isArray(value)) value.forEach((item) => collectAssets(item, refs));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => {
      if ((key === 'image' || key === 'audio' || key === 'src') && typeof nested === 'string') refs.push(nested);
      else collectAssets(nested, refs);
    });
  }
  return refs;
}

// Validates tests/<testId> the way src/services/loadTest.js loads it.
export function validateTest(testsDir, testId) {
  const dir = path.join(testsDir, testId);
  const errors = [];
  const exists = (relative) => existsSync(path.join(dir, relative)) && statSync(path.join(dir, relative)).isFile();
  const read = (relative) => {
    if (!exists(relative)) {
      errors.push(`Missing file: tests/${testId}/${relative}`);
      return null;
    }
    try {
      const data = readJsonFile(path.join(dir, relative));
      if (data?.schemaVersion !== undefined && data.schemaVersion !== 1) errors.push(`Unsupported schemaVersion ${data.schemaVersion} in ${relative}`);
      errors.push(...textProblems(data, relative));
      return data;
    } catch (error) {
      errors.push(`Invalid JSON in tests/${testId}/${relative} (${error.message})`);
      return null;
    }
  };

  const config = read('config.json');
  if (!config) return errors;

  const sections = Array.isArray(config.sections) ? config.sections : ['listening', 'reading', 'writing'];
  for (const module of sections) {
    const questions = read(module === 'writing' ? 'writing/tasks.json' : `${module}/questions.json`);
    const answersFile = `${module}/answers.json`;
    const answers = module === 'writing' && !exists(answersFile) ? { answers: {} } : read(answersFile);
    if (!questions || !answers) continue;

    const minutes = questions.durationMinutes ?? config.durations?.[module];
    if (!(Number(minutes) > 0)) errors.push(`${module}: needs durationMinutes`);
    const readingTimes = [questions.readingTimeSeconds, ...(questions.sections || []).map((section) => section?.readingTimeSeconds)];
    if (readingTimes.some((value) => value !== undefined && !(typeof value === 'number' && value >= 0))) {
      errors.push(`${module}: readingTimeSeconds must be a number >= 0`);
    }

    const assets = collectAssets(questions);
    if (module === 'listening' && questions.audioMode !== 'perTask' && config.audio !== null) assets.push(config.audio || 'listening/audio.mp3');
    if (module === 'listening' && !assets.some((ref) => /\.(mp3|wav|ogg|m4a|mpeg)$/i.test(ref))) {
      errors.push('listening: no audio is played (config.audio is null and no question has an "audio" file)');
    }
    assets.filter((ref) => !/^(https?:|data:|blob:)/i.test(ref)).forEach((ref) => {
      const relative = ref.replace(/^\.?\//, '');
      if (!exists(relative)) errors.push(`${module}: missing asset tests/${testId}/${ref}`);
      else if (!LOADABLE_ASSET.test(relative)) errors.push(`${module}: asset tests/${testId}/${ref} is not loaded by the app (audio must be in listening/, images in assets/)`);
    });

    const answerKey = { ...(answers.answers || {}) };
    if (answers.wordSearch?.question && answers.wordSearch?.acceptedAnswers) answerKey[String(answers.wordSearch.question)] = answers.wordSearch.acceptedAnswers;
    errors.push(...answerKeyProblems(questions, answerKey).map((problem) => `${module}: ${problem}`));
  }
  return errors;
}
