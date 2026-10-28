import { answerStorageKey, getSavedJson, writingStorageKey } from './storage.js';
import { NO_INFORMATION_VALUE } from './constants.js';

const INVISIBLE_CHARACTERS = /[­​-‍⁠﻿]/g;
const APOSTROPHE_VARIANTS = /[‘’ʼ´`]/g;

// Comparison form of an answer: composed Unicode (NFC), no invisible characters, one apostrophe,
// case/spacing ignored and a final . ! ? dropped. German letters are never folded (ä ≠ a, ß ≠ ss).
export function normalize(value) {
  const resolved = value === NO_INFORMATION_VALUE ? '' : value;
  return String(resolved ?? '')
    .normalize('NFC')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(APOSTROPHE_VARIANTS, "'")
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/\s+/g, ' ')
    .replace(/(\S)\s*[.!?]+$/, '$1');
}

export function isCorrect(value, accepted = []) {
  const normalized = normalize(value);
  if (!normalized && value !== NO_INFORMATION_VALUE) return false;
  return accepted.some((item) => normalize(item) === normalized);
}

export function acceptedAnswersFor(entry) {
  if (Array.isArray(entry)) return entry;
  if (typeof entry === 'string' || typeof entry === 'number') return [String(entry)];
  if (entry && typeof entry === 'object' && Array.isArray(entry.acceptedAnswers)) return entry.acceptedAnswers;
  return [];
}

function orderFromAnswer(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') return value.split('|').map((item) => item.trim()).filter(Boolean);
  return [];
}

function isSequenceCorrect(value, correctOrder = []) {
  const given = orderFromAnswer(value);
  if (given.length !== correctOrder.length) return false;
  return given.every((id, index) => id === correctOrder[index]);
}

function evaluateWordSearch(studentAnswer, config) {
  const accepted = (config.acceptedAnswers || []).map((w) => normalize(w));
  let enteredWords = [];
  if (Array.isArray(studentAnswer)) {
    enteredWords = studentAnswer;
  } else if (studentAnswer && typeof studentAnswer === 'object') {
    enteredWords = Object.values(studentAnswer);
  } else if (typeof studentAnswer === 'string') {
    enteredWords = studentAnswer.split(/[,;\n\s]+/);
  }

  const foundUnique = new Set();
  enteredWords.forEach((word) => {
    const norm = normalize(word);
    if (norm && accepted.includes(norm)) {
      foundUnique.add(norm);
    }
  });

  const maxMarks = config.maxMarks || 12;
  const points = Math.min(foundUnique.size, maxMarks);
  const displayStudent = enteredWords.map((w) => String(w).trim()).filter(Boolean).join(', ');
  const displayCorrect = (config.acceptedAnswers || []).join(', ');

  return {
    points,
    maxMarks,
    displayStudent: displayStudent || '[No words entered]',
    displayCorrect
  };
}

function extractQuestionPrompts(test) {
  const map = {};
  if (!test) return map;
  const set = (q, text, section) => {
    if (q != null) {
      const cleanText = String(text || '').replace(/^\d+[\.\)]\s*/, '').trim();
      map[String(q)] = { text: cleanText, section: section || '' };
    }
  };
  const sections = Array.isArray(test.sections) ? test.sections : [];
  sections.forEach((section) => {
    const sectionLabel = section.title || section.passageTitle || '';
    (section.blocks || []).forEach((block) => {
      set(block.q, block.prompt || block.title || block.label || section.passageTitle, sectionLabel);
      if (block.type === 'dialogueWordBank' && Array.isArray(block.lines)) {
        block.lines.forEach((line) => {
          set(line.q, `${line.speaker ? line.speaker + ': ' : ''}${line.before || ''}______${line.after || ''}`, sectionLabel);
        });
      }
      if (block.type === 'matching' && Array.isArray(block.leftItems)) {
        block.leftItems.forEach((item) => set(item.q, item.text || item.label, sectionLabel));
      }
      if (Array.isArray(block.items)) {
        block.items.forEach((item) => set(item.q, item.prompt || item.text, sectionLabel));
      }
      if (Array.isArray(block.questions)) {
        block.questions.forEach((item) => set(item.q, item.prompt || item.text, sectionLabel));
      }
    });
  });
  // Writing form tasks (Schreiben Teil 1) keep their questions in task.rows.
  (Array.isArray(test.tasks) ? test.tasks : []).forEach((task) => {
    (task.rows || []).forEach((row) => set(row.q, row.label, task.title));
  });
  return map;
}

// Marks reserved for faculty evaluation of free-text writing (e.g. "Frage 3 … 10 Punkte").
function manualReviewMarks(writing, autoTotal) {
  const review = writing?.manualReview;
  if (review && typeof review.maxMarks === 'number') return review.maxMarks;
  if (review && typeof review.marks === 'number') return review.marks;
  if (typeof writing?.maxMarks === 'number' && writing.maxMarks > autoTotal) return writing.maxMarks - autoTotal;
  return 0;
}

function manualTaskTitles(writing) {
  return (Array.isArray(writing?.tasks) ? writing.tasks : [])
    .filter((task) => !(task.rows || []).some((row) => row.q != null))
    .map((task) => task.title)
    .filter(Boolean);
}

function objectiveRows(test, answers) {
  const wordSearchQ = test.wordSearchConfig?.question ? String(test.wordSearchConfig.question) : null;
  const promptMap = extractQuestionPrompts(test);

  return Object.keys(test.answerKey || {})
    .sort((a, b) => Number(a) - Number(b))
    .map((q) => {
      const qText = promptMap[String(q)]?.text || '';
      const section = promptMap[String(q)]?.section || '';
      const row = buildRow(test, answers, q, qText, wordSearchQ);
      return { ...row, section };
    });
}

function buildRow(test, answers, q, qText, wordSearchQ) {
  if (wordSearchQ && q === wordSearchQ && test.wordSearchConfig) {
    const evalRes = evaluateWordSearch(answers?.[q], test.wordSearchConfig);
    return {
      q,
      questionText: qText || 'Wortsuche (Word Search)',
      isWordSearch: true,
      student: evalRes.displayStudent,
      correct: evalRes.displayCorrect,
      marksObtained: evalRes.points,
      maxMarks: evalRes.maxMarks,
      ok: evalRes.points > 0
    };
  }
  const entry = test.answerKey[q];
  const marksWeight = typeof entry === 'object' && !Array.isArray(entry) && typeof entry.marks === 'number' ? entry.marks : 1;
  if (entry && typeof entry === 'object' && !Array.isArray(entry) && Array.isArray(entry.correctOrder)) {
    const ok = isSequenceCorrect(answers?.[q], entry.correctOrder);
    return {
      q,
      questionText: qText || 'Gesprächsreihenfolge (Dialogue Order)',
      isWordSearch: false,
      student: orderFromAnswer(answers?.[q]).join(' → '),
      correct: entry.correctOrder.join(' → '),
      marksObtained: ok ? marksWeight : 0,
      maxMarks: marksWeight,
      ok
    };
  }
  const accepted = acceptedAnswersFor(entry);
  const ok = isCorrect(answers?.[q], accepted);
  return {
    q,
    questionText: qText,
    isWordSearch: false,
    student: answers?.[q] || '',
    correct: accepted[0] || '',
    marksObtained: ok ? marksWeight : 0,
    maxMarks: marksWeight,
    ok
  };
}

function objectiveModuleReport(test, answers) {
  const rows = objectiveRows(test, answers);
  const correct = rows.reduce((sum, row) => sum + row.marksObtained, 0);
  const total = rows.reduce((sum, row) => sum + row.maxMarks, 0);
  const lines = [
    test.title,
    `Score: ${correct}/${total}`,
    '',
    'Question | Student Answer | Correct Answer | Result',
    '---------------------------------------------------'
  ];
  rows.forEach((row) => {
    if (row.isWordSearch) {
      lines.push(`${row.q} (Wortsuche) | ${row.student} | Total 12 words | ${row.marksObtained}/${row.maxMarks} pts`);
    } else {
      lines.push(`${row.q} | ${row.student || '-'} | ${row.correct || '-'} | ${row.ok ? 'Correct' : 'Wrong'}`);
    }
  });
  return { label: test.title, correct, total, text: lines.join('\n') };
}

function writingModuleReport(test, responses) {
  const part1 = typeof responses?.part1 === 'object' ? responses.part1 : {};
  const part2 = typeof responses?.part2 === 'string' && responses.part2 ? responses.part2 : (typeof responses?.part1 === 'string' ? responses.part1 : '');
  const rows = objectiveRows({ answerKey: test.answerKey }, part1);
  const hasPart1 = rows.length > 0;
  const correct = rows.filter((row) => row.ok).length;
  
  const textLines = [test.title, ''];
  if (hasPart1) {
    textLines.push(
      `Schreiben – Teil 1: ${correct}/${rows.length}`,
      ...rows.map((row) => `${row.q} | ${row.student || '-'} | ${row.correct || '-'} | ${row.ok ? 'Correct' : 'Wrong'}`),
      ''
    );
  }
  textLines.push(
    'Schreiben – Text / Mitteilung',
    '-----------------------------',
    part2.trim() || '[No answer typed]',
    '',
    'Requires faculty/manual evaluation.'
  );

  return {
    label: hasPart1 ? `${test.title} (Teil 1)` : test.title,
    correct,
    total: rows.length,
    text: textLines.join('\n')
  };
}

function cleanFilename(value = 'student') {
  return String(value).trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'student';
}

export function generateEvaluationData(profile, testBundle) {
  const modules = testBundle.modules || ['listening', 'reading', 'writing', 'grammar'];
  const activeModules = modules.filter((m) => testBundle[m]);

  const moduleResults = activeModules.map((moduleId) => {
    if (moduleId === 'writing') {
      const responses = getSavedJson(writingStorageKey(testBundle.writing), { part1: {}, part2: '', letters: {} });
      const part1 = typeof responses?.part1 === 'object' ? responses.part1 : {};
      const rows = objectiveRows({ answerKey: testBundle.writing.answerKey, sections: testBundle.writing.sections }, part1);
      const correct = rows.filter((r) => r.ok).reduce((sum, r) => sum + r.marksObtained, 0);
      const autoMax = rows.reduce((sum, r) => sum + r.maxMarks, 0);
      // Free-text tasks are graded by faculty, but their marks still count toward the writing total
      // (e.g. Unit 3: Aufgabe 1 manual 5 + Aufgabe 2 auto 5 = 10).
      const configuredManual = Math.max(0, (testBundle.marks?.writing ?? 0) - autoMax);
      const legacyManual = rows.length === 0
        ? (testBundle.writing.tasks || []).reduce((sum, t) => sum + (t.maxMarks || (t.id === 'teil1' ? 10 : 5)), 0) || 10
        : 0;
      const manualMax = manualReviewMarks(testBundle.writing, autoMax) || configuredManual || legacyManual;
      const isManualReview = rows.length === 0;

      // Extract all letter/essay task responses
      const letterTasks = (testBundle.writing.tasks || []).filter((t) => t.type === 'letter' || t.type === 'email' || t.points || t.sourceEmail);
      const writtenTasks = letterTasks.map((t, idx) => {
        const taskId = t.id || `task_${idx}`;
        const answer =
          (responses?.letters && typeof responses.letters[taskId] === 'string')
            ? responses.letters[taskId]
            : (idx === 0 ? (typeof responses?.part2 === 'string' ? responses.part2 : (typeof responses?.part1 === 'string' ? responses.part1 : '')) : '');
        return {
          title: t.title || `Schreiben Aufgabe ${idx + 1}`,
          response: String(answer || '').trim()
        };
      }).filter((wt) => wt.response);

      const legacyPart2 = typeof responses?.part2 === 'string' && responses.part2 ? responses.part2 : (typeof responses?.part1 === 'string' ? responses.part1 : '');

      return {
        id: 'writing',
        title: testBundle.writing.title || 'Schreiben (Writing)',
        correct,
        total: autoMax + manualMax,
        autoMax,
        hasPart1: rows.length > 0,
        manualMax,
        isManualReview,
        rows,
        writtenTasks,
        textResponse: writtenTasks.length > 0 ? writtenTasks.map((wt) => `【${wt.title}】\n${wt.response}`).join('\n\n') : legacyPart2.trim()
      };
    }

    const test = testBundle[moduleId];
    const answers = getSavedJson(answerStorageKey(test), {});
    const rows = objectiveRows(test, answers);
    const correct = rows.reduce((sum, row) => sum + row.marksObtained, 0);
    const total = rows.reduce((sum, row) => sum + row.maxMarks, 0);
    return {
      id: moduleId,
      title: test.title || moduleId.toUpperCase(),
      correct,
      total,
      isManualReview: false,
      rows
    };
  });

  const totalObtained = moduleResults.reduce((sum, m) => sum + m.correct, 0);
  // Paper total includes faculty-graded marks; the percentage only covers auto-graded marks so
  // pending writing does not count against the candidate.
  const totalMax = moduleResults.reduce((sum, m) => sum + m.total, 0);
  const pendingMarks = moduleResults.reduce((sum, m) => sum + (m.manualMax || 0), 0);
  const gradedMax = totalMax - pendingMarks;
  const percentage = gradedMax > 0 ? Math.round((totalObtained / gradedMax) * 100) : 0;
  const status = percentage >= 60 ? 'PASSED (BESTANDEN)' : 'NEEDS PRACTICE';

  return {
    studentName: profile?.studentName || 'Anonymous Student',
    studentId: profile?.studentId || '-',
    candidateEmail: profile?.email || '-',
    testName: testBundle.name,
    testId: testBundle.id,
    level: testBundle.level || 'A1',
    date: new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    totalObtained,
    totalMax,
    pendingMarks,
    percentage,
    status,
    hasManualReview: moduleResults.some((m) => m.isManualReview),
    moduleResults
  };
}

export function buildHtmlReport(data) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Examination Report - ${data.studentName} - ${data.testName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 12mm 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-wrap {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .institute-title h1 {
      margin: 0 0 4px;
      font-size: 21px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .institute-title p {
      margin: 0;
      color: #475569;
      font-size: 13px;
      font-weight: 500;
    }
    .badge-grade {
      background: ${data.percentage >= 60 ? '#ecfdf5' : '#fef2f2'};
      color: ${data.percentage >= 60 ? '#047857' : '#b91c1c'};
      border: 1.5px solid ${data.percentage >= 60 ? '#a7f3d0' : '#fecaca'};
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 13px;
      text-align: right;
      line-height: 1.3;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .info-item span {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .info-item strong {
      font-size: 14px;
      color: #0f172a;
    }
    .score-summary-grid {
      display: grid;
      grid-template-columns: 2fr repeat(${data.moduleResults.length}, 1fr);
      gap: 10px;
      margin-bottom: 24px;
    }
    .score-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .score-card.total-card {
      background: #0f172a;
      color: #ffffff;
      border: 1px solid #0f172a;
    }
    .score-card.total-card span { color: #94a3b8; }
    .score-card span {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }
    .score-card .score-val {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.1;
    }
    .score-card .score-sub {
      font-size: 12px;
      opacity: 0.85;
      margin-top: 4px;
    }
    .module-section {
      margin-top: 20px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
      margin-bottom: 20px;
      background: #ffffff;
    }
    .module-header {
      background: #f1f5f9;
      border-bottom: 1.5px solid #cbd5e1;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .module-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .module-header .module-score-pill {
      font-weight: 800;
      background: #e2e8f0;
      color: #0f172a;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      border: 1px solid #cbd5e1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead {
      display: table-header-group;
    }
    th {
      background: #f8fafc;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1.5px solid #cbd5e1;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #fcfdfe;
    }
    tr:last-child td { border-bottom: none; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .status-correct {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .status-wrong {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }
    .writing-review-box {
      padding: 16px;
      background: #f8fafc;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      color: #1e293b;
      border-top: 1px dashed #cbd5e1;
    }
    .actions-bar {
      margin-top: 24px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      padding: 10px 20px;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print {
      background: #0f172a;
      color: #ffffff;
    }
    .btn-print:hover { background: #1e293b; }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .report-wrap {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      .actions-bar { display: none !important; }
      .module-section {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-bottom: 16px !important;
        border: 1px solid #cbd5e1 !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="report-wrap">
    <div class="header-bar">
      <div class="institute-title">
        <h1>Bright Future Foundation · German Assessment</h1>
        <p>Computer-Based Examination (CBT) Official Performance Transcript</p>
      </div>
      <div class="badge-grade">
        ${data.status}<br>
        <small style="font-weight: 500; font-size: 12px; opacity: 0.9;">Score: ${data.percentage}%</small>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <span>Candidate</span>
        <strong>${data.studentName}</strong>
      </div>
      <div class="info-item">
        <span>Assessment Paper</span>
        <strong>${data.testName}</strong>
      </div>
      <div class="info-item">
        <span>CEFR Level</span>
        <strong>Level ${data.level}</strong>
      </div>
      <div class="info-item">
        <span>Completed Date</span>
        <strong>${data.date}</strong>
      </div>
    </div>

    <div class="score-summary-grid">
      <div class="score-card total-card">
        <span>Objective Marks Score</span>
        <div class="score-val">${data.totalObtained} / ${data.totalMax}</div>
        <div class="score-sub">Objective Accuracy: ${data.percentage}%${data.pendingMarks > 0 ? ` (+ ${data.pendingMarks} Writing Marks Pending Evaluation)` : ''}</div>
      </div>
      ${data.moduleResults.map((m) => `
        <div class="score-card">
          <span>${m.id.toUpperCase()}</span>
          ${m.isManualReview ? `
            <div class="score-val" style="color: #64748b; font-size: 20px;">Pending Review</div>
            <div class="score-sub">Faculty Grade (Max ${m.total} Marks)</div>
          ` : `
            <div class="score-val" style="color: #1e3a8a;">${m.correct} / ${m.total}</div>
            <div class="score-sub">${m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0}% marks</div>
          `}
        </div>
      `).join('')}
    </div>

    ${data.moduleResults.map((m) => `
      <div class="module-section">
        <div class="module-header">
          <h3>${m.title}</h3>
          <span class="module-score-pill">${m.isManualReview ? `Manual Faculty Evaluation (Max: ${m.total} Marks)` : `Score: ${m.correct} / ${m.total} Marks`}</span>
        </div>
        ${m.rows && m.rows.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 70px;">Frage #</th>
                <th style="width: 32%;">Question / Statement</th>
                <th>Candidate's Response</th>
                <th>Expected Solution</th>
                <th style="width: 80px; text-align: center;">Marks</th>
                <th style="width: 100px; text-align: center;">Result</th>
              </tr>
            </thead>
            <tbody>
              ${m.rows.map((r) => `
                <tr>
                  <td><strong>Q${r.q}</strong></td>
                  <td style="color: #334155; font-size: 13px;">${r.questionText ? String(r.questionText).replace(/</g, '&lt;') : `Frage ${r.q}`}</td>
                  <td>${r.student ? String(r.student).replace(/</g, '&lt;') : '<em style="color:#94a3b8;">[No Answer]</em>'}</td>
                  <td style="color: #0f766e; font-weight: 600;">${r.correct ? String(r.correct).replace(/</g, '&lt;') : '-'}</td>
                  <td style="text-align: center; font-weight: 700;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; background: ${r.ok ? '#ecfdf5' : '#fef2f2'}; color: ${r.ok ? '#059669' : '#dc2626'}; border: 1px solid ${r.ok ? '#a7f3d0' : '#fecaca'};">
                      ${r.marksObtained} / ${r.maxMarks}
                    </span>
                  </td>
                  <td style="text-align: center;">
                    <span class="status-badge ${r.ok ? 'status-correct' : 'status-wrong'}">
                      ${r.ok ? '✓ Correct' : '✗ Wrong'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
        ${m.textResponse ? `
          <div style="padding: 12px 20px; font-weight: 700; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 13px;">
            Written Essay / Letter Response (Max ${m.total} Marks):
          </div>
          <div class="writing-review-box">${String(m.textResponse).replace(/</g, '&lt;')}</div>
        ` : ''}
      </div>
    `).join('')}

    <div class="actions-bar">
      <button class="btn btn-print" onclick="window.print()">
        🖨️ Print / Save to PDF
      </button>
    </div>
  </div>
</body>
</html>`;
}

export function downloadCompleteReport(profile, testBundle) {
  const data = generateEvaluationData(profile, testBundle);
  const html = buildHtmlReport(data);

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${cleanFilename(profile?.studentName)}-${testBundle.id}-report.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

