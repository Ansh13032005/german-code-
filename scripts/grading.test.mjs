import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptedAnswersFor, generateEvaluationData, isCorrect, normalize } from '../src/utils/report.js';
import { answerStorageKey } from '../src/utils/storage.js';
import { answerKeyProblems, parseJsonText, readJsonFile, textProblems, validateTest } from './package-checks.mjs';

const testsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'tests');
const UNIT = 'Unit 1';
const unitJson = (relative) => readJsonFile(path.join(testsDir, UNIT, relative));

// Official answers transcribed by hand from the original sources, keyed by question text instead of
// number, so a renumbered or reordered question cannot silently pick up another question's answer.
// Hören: answer-key images in "Listening.docx". Lesen: "Unit 1 Answer Key.docx".
const OFFICIAL = {
  ordering: {
    'M A T T E O.': 7,
    '0173 896543.': 13,
    'Mein Name ist Matteo.': 5,
    'Aha, und ich komme aus Japan.': 10,
    'Ich wohne in Rödelheim. Und du?': 11,
    'Matteo…? Wie schreibt man das?': 6,
    'Auch gut. Wie heißt du?': 3,
    'Ich wohne in Eschborn. Akiko, wie ist deine Telefonnummer?': 12,
    'Gut, danke. Und dir?': 2,
    'Ich komme aus Italien.': 9,
    'Wie alt bist du?': 14,
    'Ich bin Akiko. Und du?': 4,
    'Ah, danke. Und woher kommst du?': 8,
    'Ich bin 21 Jahre alt.': 15
  },
  orderingExample: { "Hallo, wie geht's?": 1 },
  gaps: {
    'Hallo, ich heiße Akiko. Und wie ___ ihr?': 'heißt',
    'Wir ___ Tong aus China und …': 'sind',
    'Aha, und wo ___ ihr?': 'wohnt',
    'Wir ___ in Bornheim.': 'wohnen',
    'Was ___ ihr von Beruf?': 'seid',
    'Ich ___ Programmierer bei Continental.': 'bin',
    'Und ich bin Hausfrau. Was ___ du von Beruf, Akiko?': 'bist',
    'Ich ___ nicht. Ich lerne Deutsch.': 'arbeite'
  },
  choices: {
    'Wie alt ist Rahul?': '20 Jahre',
    'Wo wohnt Rahuls Familie?': 'In Ahmedabad',
    'Wann beginnt der Deutschunterricht?': 'Um neun Uhr',
    'Was ist Rahuls Mutter von Beruf?': 'Lehrerin',
    'Was möchte Rahul später werden?': 'Ingenieur',
    'Rahul kommt aus Deutschland.': 'Falsch',
    'Rahul wohnt seit drei Monaten in Berlin.': 'Richtig',
    'Rahul hat am Samstag Deutschunterricht.': 'Falsch',
    'Rahul spielt gern Fußball.': 'Richtig',
    'Am Sonntag telefoniert Rahul mit seiner Familie.': 'Richtig'
  },
  typed: {
    'Maria kommt aus ____________________.': 'Österreich',
    'Maria wohnt jetzt in ____________________.': 'Hamburg',
    'Maria arbeitet in einem ____________________.': 'Hotel',
    'Ihre Kollegin heißt ____________________.': 'Lisa',
    'Am Sonntag besucht Maria ihre ____________________.': 'Schwester',
    'Wie alt ist Maria?': 'Maria ist 21 Jahre alt.',
    'Wann beginnt ihre Arbeit?': 'Ihre Arbeit beginnt um acht Uhr.',
    'Wie fährt Maria zur Arbeit?': 'Maria fährt mit dem Bus zur Arbeit.',
    'Was macht Maria am Freitag?': 'Am Freitag geht Maria mit Lisa ins Kino.',
    'Was ist Marias Hobby?': 'Ihr Hobby ist Lesen.'
  }
};

const WRONG_TYPED = {
  'Maria kommt aus ____________________.': 'Osterreich',
  'Maria wohnt jetzt in ____________________.': 'Berlin',
  'Maria arbeitet in einem ____________________.': 'Restaurant',
  'Ihre Kollegin heißt ____________________.': 'Anna',
  'Am Sonntag besucht Maria ihre ____________________.': 'Mutter',
  'Wie alt ist Maria?': 'Maria ist 20 Jahre alt.',
  'Wann beginnt ihre Arbeit?': 'Um neun Uhr.',
  'Wie fährt Maria zur Arbeit?': 'Mit dem Auto.',
  'Was macht Maria am Freitag?': 'Am Freitag kocht sie zu Hause.',
  'Was ist Marias Hobby?': 'Ihr Hobby ist Fußball.'
};

// Mirrors the bundle src/services/loadTest.js builds in the browser (that loader needs Vite's import.meta.glob).
function loadUnit1() {
  const config = unitJson('config.json');
  const writingAnswers = unitJson('writing/answers.json');
  const scoped = (exam, extra) => ({ ...exam, ...extra, id: `${UNIT}-${exam.id}` });
  return {
    ...config,
    config,
    modules: ['listening', 'reading', 'writing'],
    listening: scoped(unitJson('listening/questions.json'), { answerKey: unitJson('listening/answers.json').answers }),
    reading: scoped(unitJson('reading/questions.json'), { answerKey: unitJson('reading/answers.json').answers }),
    writing: scoped(unitJson('writing/tasks.json'), { answerKey: writingAnswers.answers || {}, manualReview: writingAnswers.manualReview || null })
  };
}

const blocksOf = (exam) => exam.sections.flatMap((section) => section.blocks);
const readingBlock = (bundle, prompt) => blocksOf(bundle.reading).find((block) => block.prompt === prompt);
const readingKey = (bundle, prompt) => acceptedAnswersFor(bundle.reading.answerKey[readingBlock(bundle, prompt).q]);

// Grades a submission with the real report code; the answers are read from (stubbed) localStorage
// under the same keys the exam screens save them to.
function grade(bundle, { listening = {}, reading = {} }) {
  const store = new Map([
    [answerStorageKey(bundle.listening), JSON.stringify(listening)],
    [answerStorageKey(bundle.reading), JSON.stringify(reading)]
  ]);
  globalThis.window = { localStorage: { getItem: (key) => store.get(key) ?? null, setItem() {}, removeItem() {} } };
  try {
    const data = generateEvaluationData({ studentName: 'Regression Test' }, bundle);
    const module = (id) => data.moduleResults.find((result) => result.id === id);
    return { data, listening: module('listening'), reading: module('reading') };
  } finally {
    delete globalThis.window;
  }
}

// The submission a student makes by choosing every official answer on screen.
function officialSubmission(bundle) {
  const listening = {};
  const reading = {};
  const found = new Set();
  const take = (table, text) => {
    assert.ok(Object.hasOwn(table, text), `Not a question in the original source: "${text}"`);
    assert.ok(!found.has(text), `Question appears twice: "${text}"`);
    found.add(text);
    return table[text];
  };

  for (const block of blocksOf(bundle.listening)) {
    if (block.type === 'conversationOrdering') {
      for (const item of block.items) {
        if (item.example) assert.equal(take(OFFICIAL.orderingExample, item.text), item.position);
        else listening[item.q] = String(take(OFFICIAL.ordering, item.text));
      }
    }
    if (block.type === 'dialogueWordBank') {
      for (const line of block.lines.filter((entry) => entry.q != null)) {
        listening[line.q] = take(OFFICIAL.gaps, `${line.before}___${line.after}`);
      }
    }
  }
  for (const block of blocksOf(bundle.reading)) {
    if (block.type === 'choice') {
      const official = take(OFFICIAL.choices, block.prompt);
      const keys = Object.keys(block.options).filter((key) => block.options[key] === official);
      assert.equal(keys.length, 1, `Q${block.q}: exactly one option must read "${official}"`);
      reading[block.q] = keys[0];
    }
    if (block.type === 'textInput') reading[block.q] = take(OFFICIAL.typed, block.prompt);
  }

  const missing = [OFFICIAL.ordering, OFFICIAL.orderingExample, OFFICIAL.gaps, OFFICIAL.choices, OFFICIAL.typed]
    .flatMap(Object.keys)
    .filter((text) => !found.has(text));
  assert.deepEqual(missing, [], 'Every question of the original test must appear in the CBT');
  return { listening, reading };
}

test('Unit 1 package: one answer per question, valid options and positions, clean UTF-8 text', () => {
  assert.deepEqual(validateTest(testsDir, UNIT), []);
});

test('official answers from the source documents score full marks', () => {
  const bundle = loadUnit1();
  const result = grade(bundle, officialSubmission(bundle));
  assert.equal(result.listening.correct, 22);
  assert.equal(result.listening.total, 22);
  assert.equal(result.reading.correct, 20);
  assert.equal(result.reading.total, 20);
  for (const row of [...result.listening.rows, ...result.reading.rows]) {
    assert.ok(row.ok, `Q${row.q} (${row.questionText}) should be correct for "${row.student}"`);
    assert.notEqual(row.correct, '', `Q${row.q} must show its expected answer`);
  }
  assert.equal(result.data.totalObtained, 42);
  assert.equal(result.data.percentage, 100);
});

test('genuinely wrong answers are still marked wrong', () => {
  const bundle = loadUnit1();
  const official = officialSubmission(bundle);
  const rotate = (answers, qs) => Object.fromEntries(qs.map((q, index) => [q, answers[qs[(index + 1) % qs.length]]]));
  const listeningQs = (type) => blocksOf(bundle.listening)
    .filter((block) => block.type === type)
    .flatMap((block) => (block.items || block.lines).filter((entry) => entry.q != null).map((entry) => String(entry.q)));
  const wrongListening = {
    ...rotate(official.listening, listeningQs('conversationOrdering')),
    ...rotate(official.listening, listeningQs('dialogueWordBank'))
  };
  const wrongReading = {};
  for (const block of blocksOf(bundle.reading)) {
    if (block.type === 'choice') wrongReading[block.q] = Object.keys(block.options).find((key) => key !== official.reading[block.q]);
    if (block.type === 'textInput') wrongReading[block.q] = WRONG_TYPED[block.prompt];
  }

  const result = grade(bundle, { listening: wrongListening, reading: wrongReading });
  assert.equal(result.listening.correct, 0);
  assert.equal(result.reading.correct, 0);
  assert.equal(result.data.totalObtained, 0);
});

test('blank, whitespace-only and invisible-only answers score nothing', () => {
  const bundle = loadUnit1();
  assert.equal(grade(bundle, {}).data.totalObtained, 0);
  const typedQs = blocksOf(bundle.reading).filter((block) => block.type === 'textInput').map((block) => block.q);
  const fillers = ['', '   ', '​', ' ', '\r\n', '﻿'];
  const reading = Object.fromEntries(typedQs.map((q, index) => [q, fillers[index % fillers.length]]));
  assert.equal(grade(bundle, { reading }).reading.correct, 0);
  assert.equal(isCorrect('', acceptedAnswersFor('')), false);
});

test('"Hallo, wie geht\'s?" is the locked worked example, as in the original, and is not scored', () => {
  const bundle = loadUnit1();
  const items = blocksOf(bundle.listening).find((block) => block.type === 'conversationOrdering').items;
  const example = items.find((item) => item.text === "Hallo, wie geht's?");
  assert.equal(example.example, true);
  assert.equal(example.position, 1);
  assert.equal(example.q, undefined);
  assert.equal(items.filter((item) => item.example).length, 1);
  assert.ok(!Object.hasOwn(bundle.listening.answerKey, '7'));
});

test('the dialogue line "… Paola aus Brasilien." from the original is shown between gaps 17 and 18', () => {
  const lines = blocksOf(loadUnit1().listening).find((block) => block.type === 'dialogueWordBank').lines;
  const index = lines.findIndex((line) => line.text === '… Paola aus Brasilien.');
  assert.ok(index > 0);
  assert.equal(lines[index].speaker, 'Paola');
  assert.equal(lines[index].q, undefined);
  assert.equal(lines[index - 1].q, 17);
  assert.equal(lines[index + 1].q, 18);
});

test('attempts saved before the fix keep their storage keys and are re-graded correctly', () => {
  const bundle = loadUnit1();
  assert.equal(answerStorageKey(bundle.listening), 'bff-german-Unit 1-hoeren-answers');
  assert.equal(answerStorageKey(bundle.reading), 'bff-german-Unit 1-lesen-answers');
  const { listening, reading } = officialSubmission(bundle);
  // Older attempts still contain an answer for the former question 7; it is ignored now.
  const result = grade(bundle, { listening: { ...listening, 7: '1' }, reading });
  assert.equal(result.listening.correct, 22);
  assert.equal(result.listening.total, 22);
  assert.ok(!result.listening.rows.some((row) => row.q === '7'));
});

test('answer-key entries written as a string, number, list or object are all understood', () => {
  assert.deepEqual(acceptedAnswersFor('b'), ['b']);
  assert.deepEqual(acceptedAnswersFor(7), ['7']);
  assert.deepEqual(acceptedAnswersFor(['Hamburg', 'in Hamburg']), ['Hamburg', 'in Hamburg']);
  assert.deepEqual(acceptedAnswersFor({ acceptedAnswers: ['Lisa'] }), ['Lisa']);
  assert.deepEqual(acceptedAnswersFor(undefined), []);
  assert.equal(isCorrect('b', acceptedAnswersFor('b')), true);
  assert.equal(isCorrect('heißt', acceptedAnswersFor('heißt')), true);
  assert.equal(isCorrect('7', acceptedAnswersFor(7)), true);
  assert.equal(isCorrect('c', acceptedAnswersFor('b')), false);
});

test('German letters are never folded into plain letters', () => {
  assert.equal(isCorrect('Osterreich', ['Österreich']), false);
  assert.equal(isCorrect('heisst', ['heißt']), false);
  assert.equal(isCorrect('fahrt', ['fährt']), false);
  assert.equal(isCorrect('Strasse', ['Straße']), false);
  assert.equal(isCorrect('mude', ['müde']), false);
  assert.equal(isCorrect('ÖSTERREICH', ['Österreich']), true);
  assert.equal(isCorrect('HEIẞT', ['heißt']), true);
  // "Oesterreich" counts only because answers.json lists it explicitly for this question.
  const bundle = loadUnit1();
  const q11 = readingKey(bundle, 'Maria kommt aus ____________________.');
  assert.equal(isCorrect('Oesterreich', q11), true);
  assert.equal(isCorrect('Osterreich', q11), false);
  assert.equal(isCorrect('Österreich', q11), true);
});

test('text that looks the same matches: decomposed umlauts, invisible characters, NBSP, CRLF, apostrophes', () => {
  assert.equal(isCorrect('Österreich', ['Österreich']), true);
  assert.equal(isCorrect('fährt', ['fährt']), true);
  assert.equal(isCorrect('  Hamburg​ ', ['Hamburg']), true);
  assert.equal(isCorrect('Ham­burg', ['Hamburg']), true);
  assert.equal(isCorrect('in Hamburg', ['in Hamburg']), true);
  assert.equal(isCorrect('﻿Lisa', ['Lisa']), true);
  assert.equal(isCorrect('Sie fährt mit dem Bus\r\nzur Arbeit.', ['Sie fährt mit dem Bus zur Arbeit.']), true);
  assert.equal(isCorrect('Wie geht’s', ["Wie geht's"]), true);
});

test('a final . ! or ? is ignored, other punctuation still counts', () => {
  const bundle = loadUnit1();
  // Before the fix "Sie ist 21 Jahre alt." was marked wrong although "Sie ist 21 Jahre alt" was right.
  assert.equal(isCorrect('Sie ist 21 Jahre alt.', readingKey(bundle, 'Wie alt ist Maria?')), true);
  assert.equal(isCorrect('Sie fährt mit dem Bus zur Arbeit', readingKey(bundle, 'Wie fährt Maria zur Arbeit?')), true);
  assert.equal(isCorrect('Sie geht mit Lisa ins Kino', readingKey(bundle, 'Was macht Maria am Freitag?')), true);
  assert.equal(isCorrect('Marias Hobby ist Lesen!', readingKey(bundle, 'Was ist Marias Hobby?')), true);
  assert.equal(isCorrect('Hamburg .', ['Hamburg']), true);
  assert.equal(normalize('um 8.00 Uhr.'), 'um 8.00 uhr');
  assert.equal(isCorrect('?', ['.']), false);
  assert.equal(isCorrect('Am Freitag, geht Maria ins Kino', ['Am Freitag geht Maria ins Kino']), false);
});

test('the validator rejects answer keys that do not line up with their questions', () => {
  const questions = {
    sections: [{
      title: 'Teil 1',
      blocks: [
        { type: 'choice', q: 1, prompt: 'Wie alt ist Rahul?', options: { a: '18 Jahre', b: '20 Jahre', c: '22 Jahre' } },
        { type: 'textInput', q: 2, prompt: 'Maria wohnt jetzt in ____.' },
        { type: 'dialogueWordBank', wordBank: ['bin', 'bist'], lines: [{ q: 3, before: 'Ich ', after: ' Akiko.' }, { q: 4, before: 'Du ', after: ' Tong.' }] },
        { type: 'conversationOrdering', items: [{ id: 'a', text: 'Hallo!', example: true, position: 1 }, { id: 'b', text: 'Hi!', q: 5 }, { id: 'c', text: 'Tschüss!', q: 6 }] }
      ]
    }]
  };
  const valid = { 1: 'b', 2: ['Hamburg', 'in Hamburg'], 3: 'bin', 4: 'bist', 5: '2', 6: '3' };
  assert.deepEqual(answerKeyProblems(questions, valid), []);

  const rejects = (answers, pattern) => {
    const problems = answerKeyProblems(questions, answers);
    assert.ok(problems.some((problem) => pattern.test(problem)), `expected ${pattern} in ${JSON.stringify(problems)}`);
  };
  rejects({ ...valid, 1: 'd' }, /"d" is not one of the options/);
  rejects({ ...valid, 1: { answer: 'b' } }, /format not understood/);
  rejects({ ...valid, 2: '' }, /empty answer/);
  rejects({ 1: 'b', 3: 'bin', 4: 'bist', 5: '2', 6: '3' }, /Question 2 .* has no answer-key entry/);
  rejects({ ...valid, 9: 'x' }, /Answer key 9 has no matching question/);
  rejects({ ...valid, 4: 'sind' }, /"sind" is not one of the options/);
  rejects({ ...valid, 4: 'bin' }, /can only be used once/);
  rejects({ ...valid, 5: '1' }, /already taken by the example/);
  rejects({ ...valid, 6: '4' }, /from 1 to 3/);
  const duplicated = { sections: [{ title: 'Teil 1', blocks: [{ type: 'textInput', q: 1 }, { type: 'textInput', q: 1 }] }] };
  assert.ok(answerKeyProblems(duplicated, { 1: 'x' }).some((problem) => /used twice/.test(problem)));
});

test('Notepad encodings: UTF-8 and UTF-8 with BOM load with CRLF; ANSI, garbled and UTF-16 files are caught', () => {
  const text = '{\r\n  "1": "heißt",\r\n  "2": ["Österreich", "Grüße", "ÄÖÜ äöü ß"]\r\n}';
  const expected = { 1: 'heißt', 2: ['Österreich', 'Grüße', 'ÄÖÜ äöü ß'] };
  const utf8 = Buffer.from(text, 'utf8');
  assert.deepEqual(parseJsonText(utf8.toString('utf8')), expected);
  assert.deepEqual(parseJsonText(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), utf8]).toString('utf8')), expected);
  assert.deepEqual(textProblems(expected), []);

  const ansi = parseJsonText(Buffer.from(text, 'latin1').toString('utf8'));
  assert.ok(textProblems(ansi).some((problem) => /not saved as UTF-8/.test(problem)));
  assert.ok(textProblems({ a: Buffer.from('Grüße', 'utf8').toString('latin1') }).some((problem) => /garbled umlauts/.test(problem)));
  assert.throws(() => parseJsonText(Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(text, 'utf16le')]).toString('utf8')));
  assert.ok(textProblems({ a: 'Österreich' }).some((problem) => /decomposed/.test(problem)));
  assert.ok(textProblems({ a: 'Hamburg​' }).some((problem) => /U\+200B/.test(problem)));
});
