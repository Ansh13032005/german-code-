import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Download,
  FileText,
  Headphones,
  Play,
  RotateCcw,
  Save,
  Search,
  Send,
  SpellCheck,
  UserRound,
  CheckCircle2,
  GraduationCap,
  Sparkles,
  Printer,
  Eye,
  X,
  Check,
  XCircle,
  Award,
  BarChart3,
  Filter,
  HelpCircle,
  Info
} from 'lucide-react';
import { loadTest, testsIndex } from './services/loadTest';
import { useCountdownTimer } from './hooks/useCountdownTimer';
import { downloadCompleteReport, generateEvaluationData } from './utils/report';
import { formatTime } from './utils/time';
import { NO_INFORMATION_VALUE } from './utils/constants';
import {
  PROFILE_KEY,
  SELECTED_TEST_KEY,
  answerStorageKey,
  getSavedJson,
  moduleStatusStorageKey,
  removeSavedJson,
  saveJson,
  writingStorageKey
} from './utils/storage';

const BRAND_LOGO = '/assets/bff-logo.png';

const MODULE_META = {
  listening: { Icon: Headphones, title: 'Listening', subtitle: 'Hören', text: '3 parts, 15 questions, supplied audio, image-based choices in Part 1.' },
  reading: { Icon: BookOpen, title: 'Reading', subtitle: 'Lesen', text: '3 parts, 15 questions, letters, websites, advertisements and notices.' },
  grammar: { Icon: SpellCheck, title: 'Grammar', subtitle: 'Grammatik', text: 'Grammar and structure questions covering forms, cases and word order.' },
  writing: { Icon: FileText, title: 'Writing', subtitle: 'Schreiben', text: '2 parts: form completion and a short written message.' }
};

function enterFullscreen() {
  try {
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    const result = request?.call(el);
    result?.catch?.(() => { });
  } catch {
    /* ignore unsupported/blocked fullscreen */
  }
}

function exitFullscreen() {
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    const result = exit?.call(document);
    result?.catch?.(() => { });
  } catch {
    /* ignore unsupported/blocked fullscreen */
  }
}

function stripLeadingNumber(text) {
  return String(text || '').replace(/^\d+[\.\)]\s*/, '').trim();
}

function App() {
  const [studentProfile, setStudentProfile] = useState(() => getSavedJson(PROFILE_KEY, null));
  const [screen, setScreen] = useState('select');
  const [initialTestId] = useState(() => getSavedJson(SELECTED_TEST_KEY, null));
  const [currentTest, setCurrentTest] = useState(null);
  const [loadingTestId, setLoadingTestId] = useState(null);
  const [moduleStatuses, setModuleStatuses] = useState({});

  const startSelectedTest = async (testId) => {
    setLoadingTestId(testId);
    try {
      const loaded = await loadTest(testId);
      saveJson(SELECTED_TEST_KEY, testId);
      setCurrentTest(loaded);
      setModuleStatuses(getSavedJson(moduleStatusStorageKey(loaded), {}));
      setScreen(studentProfile ? 'home' : 'registration');
    } catch (error) {
      console.error(error);
      removeSavedJson(SELECTED_TEST_KEY);
      alert('Could not load this test. Please check the test files.');
    } finally {
      setLoadingTestId(null);
    }
  };

  const saveProfile = (profile) => {
    saveJson(PROFILE_KEY, profile);
    setStudentProfile(profile);
    setScreen('home');
  };

  const completeModule = (moduleId, reason) => {
    if (!currentTest) return;
    setModuleStatuses((previous) => {
      const next = {
        ...previous,
        [moduleId]: { reason, completedAt: new Date().toISOString() }
      };
      saveJson(moduleStatusStorageKey(currentTest), next);
      return next;
    });
    setScreen('home');
  };

  if (screen === 'select' || !currentTest) {
    return <TestSelectionPage tests={testsIndex} initialTestId={initialTestId} onStart={startSelectedTest} loadingTestId={loadingTestId} />;
  }
  if (screen === 'registration') return <RegistrationPage initialProfile={studentProfile} onSubmit={saveProfile} />;
  if (screen === 'home') {
    return (
      <Home
        profile={studentProfile}
        selectedTest={currentTest}
        moduleStatuses={moduleStatuses}
        onStart={setScreen}
        onChangeStudent={() => setScreen('registration')}
        onChangeTest={() => setScreen('select')}
      />
    );
  }
  if (screen === 'writing') {
    return <WritingExam test={currentTest.writing} testBundle={currentTest} profile={studentProfile} onBack={() => setScreen('home')} onComplete={(reason) => completeModule('writing', reason)} />;
  }
  return <ObjectiveExam test={currentTest[screen]} testBundle={currentTest} profile={studentProfile} onBack={() => setScreen('home')} onComplete={(reason) => completeModule(screen, reason)} />;
}

function BrandMark({ compact = false }) {
  return (
    <div className={compact ? 'brand-mark compact' : 'brand-mark'}>
      <img src={BRAND_LOGO} alt="Bright Future Foundation logo" />
      {!compact && (
        <div>
          <strong>Bright Future Foundation</strong>
          <span>German A1 Practice Test</span>
        </div>
      )}
    </div>
  );
}

function TestSelectionPage({ tests, initialTestId, onStart, loadingTestId }) {
  const [selectedTestId, setSelectedTestId] = useState(() => initialTestId || tests[0]?.id || '');
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesCategory =
        category === 'All'
          ? true
          : category === 'Fastrack'
            ? test.name.toLowerCase().startsWith('fastrack')
            : category === 'Regular'
              ? test.name.toLowerCase().startsWith('regular')
              : category === 'A2 Regular'
                ? test.name.toLowerCase().startsWith('a2')
                : category === 'Worksheets'
                  ? (test.name.toLowerCase().startsWith('worksheet') || test.name.toLowerCase().startsWith('kapitel') || test.id.toLowerCase().startsWith('kapitel'))
                  : category === 'Unit Tests'
                    ? test.name.toLowerCase().startsWith('unit')
                    : true;

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || test.name.toLowerCase().includes(q) || test.id.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [tests, category, searchQuery]);

  const submit = (event) => {
    event?.preventDefault();
    if (!selectedTestId) return;
    onStart(selectedTestId);
  };

  const handleTestClick = (testId) => {
    setSelectedTestId(testId);
  };

  const handleTestDoubleClick = (testId) => {
    setSelectedTestId(testId);
    onStart(testId);
  };

  const selectedTestObj = tests.find((t) => t.id === selectedTestId);

  return (
    <div className="test-portal-layout">
      {/* Top Navigation Bar */}
      <header className="test-portal-topbar">
        <div className="test-portal-topbar-inner">
          <BrandMark />
          <div className="test-portal-badge-group">
            <span className="portal-badge primary"><GraduationCap size={15} /> Examination Portal</span>
            <span className="portal-badge secondary">German CBT</span>
          </div>
        </div>
      </header>

      {/* Main Full-Width Content Container */}
      <main className="test-portal-main">
        <div className="test-portal-container">
          {/* Welcome Banner */}
          <section className="test-portal-welcome">
            <div>
              <p className="portal-eyebrow">ASSESSMENT REPOSITORY</p>
              <h1>Select Examination Paper</h1>
              <p className="portal-subtitle">
                Select an assessment to begin practice testing. Click once to select, or double-click to launch immediately.
              </p>
            </div>
            <div className="portal-stat-pill">
              <span className="portal-stat-number">{tests.length}</span>
              <span className="portal-stat-label">Available Papers</span>
            </div>
          </section>

          {/* Filtering and Controls Bar */}
          <div className="test-portal-controls">
            <div className="portal-categories">
              {['All', 'Regular', 'Fastrack', 'Worksheets', 'Unit Tests', 'A2 Regular'].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={category === cat ? 'portal-chip active' : 'portal-chip'}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="portal-search-box">
              <Search size={17} />
              <input
                type="text"
                placeholder="Search assessment name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Tests Full-Width Table View */}
          <div className="test-portal-table-wrap">
            <div className="test-portal-table-header">
              <span className="col-name">ASSESSMENT PAPER</span>
              <span className="col-cat">TYPE / CATEGORY</span>
              <span className="col-ref">IDENTIFIER CODE</span>
              <span className="col-action">ACTION</span>
            </div>

            <div className="test-portal-table-body">
              {filteredTests.map((test) => {
                const isSelected = selectedTestId === test.id;
                const isFastrack = test.name.toLowerCase().startsWith('fastrack');
                const isWorksheet = test.name.toLowerCase().startsWith('worksheet') || test.id.toLowerCase().startsWith('kapitel');
                const isUnit = test.name.toLowerCase().startsWith('unit');
                const isA2 = test.name.toLowerCase().startsWith('a2');
                const typeLabel = isWorksheet ? 'Worksheet' : isUnit ? 'Unit Test' : isFastrack ? 'Fastrack Practice' : isA2 ? 'A2 Regular Model' : 'Start Deutsch 1';
                const tagClass = isWorksheet ? 'tag-kapitel' : isUnit ? 'tag-unit' : isFastrack ? 'tag-fastrack' : isA2 ? 'tag-a2' : 'tag-regular';

                return (
                  <div
                    key={test.id}
                    className={`test-portal-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTestClick(test.id)}
                    onDoubleClick={() => handleTestDoubleClick(test.id)}
                  >
                    <div className="col-name">
                      <div className="test-row-title-wrap">
                        <span className={`test-row-radio ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <CheckCircle2 size={16} />}
                        </span>
                        <div>
                          <strong className="test-row-name">{test.name}</strong>
                          <span className="test-row-desc">Complete computer-based evaluation module</span>
                        </div>
                      </div>
                    </div>

                    <div className="col-cat">
                      <span className={`portal-tag ${tagClass}`}>{typeLabel}</span>
                    </div>

                    <div className="col-ref">
                      <code className="portal-code">{test.id}</code>
                    </div>

                    <div className="col-action">
                      <button
                        type="button"
                        className={isSelected ? 'portal-row-btn selected' : 'portal-row-btn'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestClick(test.id);
                          onStart(test.id);
                        }}
                      >
                        {isSelected ? 'Start Exam →' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredTests.length === 0 && (
                <div className="test-portal-empty">
                  <p>No assessment papers match your search or filter.</p>
                  <button type="button" className="secondary-button" onClick={() => { setCategory('All'); setSearchQuery(''); }}>
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Launch Bar */}
      <footer className="test-portal-launchbar">
        <div className="launchbar-inner">
          <div className="launchbar-info">
            <span className="launchbar-status-dot" />
            <div className="launchbar-text">
              <span className="launchbar-sub">Ready to launch:</span>
              <strong className="launchbar-title">{selectedTestObj?.name || 'No paper selected'}</strong>
            </div>
          </div>

          <div className="launchbar-action">
            <button
              className="primary-button launchbar-btn"
              type="button"
              disabled={!selectedTestId || loadingTestId === selectedTestId}
              onClick={submit}
            >
              {loadingTestId === selectedTestId ? 'Loading Paper...' : 'Start Examination Now'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function RegistrationPage({ initialProfile, onSubmit }) {
  const [studentName, setStudentName] = useState(initialProfile?.studentName || '');
  const submit = (event) => {
    event.preventDefault();
    if (!studentName.trim()) {
      alert('Please enter student name.');
      return;
    }
    onSubmit({ studentName: studentName.trim(), registeredAt: new Date().toISOString() });
  };
  return (
    <main className="registration-shell">
      <section className="registration-card">
        <BrandMark />
        <div className="registration-title">
          <p className="eyebrow">Student Registration</p>
          <h1>Start German A1 Computer-Based Practice</h1>
          <p>Enter the student name. Test instructions and paper content are shown in German.</p>
        </div>
        <form className="registration-form" onSubmit={submit}>
          <label>
            Student full name <span>*</span>
            <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Enter student name" autoFocus />
          </label>
          <button className="primary-button full-button" type="submit"><UserRound size={18} /> Continue to test</button>
        </form>
      </section>
    </main>
  );
}

function Home({ profile, selectedTest, moduleStatuses, onStart, onChangeStudent, onChangeTest }) {
  const [showReport, setShowReport] = useState(false);
  const activeModules = selectedTest.modules || ['listening', 'reading', 'writing'];
  const completedCount = activeModules.filter((m) => moduleStatuses[m]?.completedAt).length;
  const allModulesCompleted = true;
  const anyModuleCompleted = completedCount > 0;

  return (
    <div className="portal-dashboard-layout">
      {showReport && (
        <InteractiveReportModal
          profile={profile}
          selectedTest={selectedTest}
          onClose={() => setShowReport(false)}
        />
      )}
      {/* Top Portal Header */}
      <header className="test-portal-topbar">
        <div className="test-portal-topbar-inner">
          <BrandMark />
          <div className="portal-header-student-tag">
            <span className="student-tag-label">Candidate</span>
            <strong className="student-tag-name">{profile?.studentName || 'Student'}</strong>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="portal-dashboard-main">
        <div className="portal-dashboard-container">
          {/* Hero Banner */}
          <section className="portal-dashboard-hero">
            <div className="dashboard-hero-content">
              <span className="portal-badge primary">
                <GraduationCap size={15} /> German Level {selectedTest.level || 'A1'}
              </span>
              <h1>Computer-Based Examination Dashboard</h1>
              <p className="dashboard-hero-subtitle">
                Complete your assigned test modules below. Follow the on-screen German instructions carefully for each section.
              </p>
              <div className="dashboard-hero-actions">
                <button className="secondary-button" onClick={onChangeTest}>
                  <FileText size={16} /> Switch Assessment Paper
                </button>
                <button className="secondary-button" onClick={onChangeStudent}>
                  <UserRound size={16} /> Edit Candidate Details
                </button>
                {allModulesCompleted ? (
                  <>
                    <button className="primary-button" onClick={() => setShowReport(true)}>
                      <Eye size={16} /> View Examination Report
                    </button>
                    <button className="secondary-button" onClick={() => downloadCompleteReport(profile, selectedTest)}>
                      <Download size={16} /> Export HTML
                    </button>
                  </>
                ) : (
                  <span className="portal-badge" style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
                    🔒 Report locked until all modules are completed ({completedCount}/{activeModules.length})
                  </span>
                )}
              </div>
            </div>

            <div className="dashboard-hero-summary-card">
              <div className="summary-card-level-badge">{selectedTest.level || 'A1'}</div>
              <div className="summary-card-details">
                <span className="summary-card-title">Assessment Level</span>
                <span className="summary-card-sub">Common European Framework (CEFR)</span>
              </div>
            </div>
          </section>

          {/* Module Cards Grid */}
          <section className="portal-modules-section">
            <div className="section-title-bar">
              <h2>Examination Modules</h2>
              <span className="section-count-tag">
                {(selectedTest.modules || ['listening', 'reading', 'writing']).length} Sections
              </span>
            </div>

            <div className="portal-modules-grid">
              {(selectedTest.modules || ['listening', 'reading', 'writing']).map((moduleId) => {
                const meta = MODULE_META[moduleId];
                if (!meta) return null;
                const status = moduleStatuses[moduleId];
                return (
                  <TestCard
                    key={moduleId}
                    icon={<meta.Icon size={26} />}
                    title={meta.title}
                    subtitle={meta.subtitle}
                    text={meta.text}
                    onClick={() => onStart(moduleId)}
                    status={status}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function InteractiveReportModal({ profile, selectedTest, onClose }) {
  const data = useMemo(() => generateEvaluationData(profile, selectedTest), [profile, selectedTest]);
  const [activeTab, setActiveTab] = useState('all');
  const [filterResult, setFilterResult] = useState('all'); // 'all', 'correct', 'incorrect'

  const filteredModules = useMemo(() => {
    if (activeTab === 'all') return data.moduleResults;
    return data.moduleResults.filter((m) => m.id === activeTab);
  }, [data.moduleResults, activeTab]);

  const totalQuestions = useMemo(() => {
    return data.moduleResults.reduce((acc, m) => acc + (m.rows ? m.rows.length : 0), 0);
  }, [data.moduleResults]);

  const totalCorrectQuestions = useMemo(() => {
    return data.moduleResults.reduce((acc, m) => acc + (m.rows ? m.rows.filter((r) => r.ok).length : 0), 0);
  }, [data.moduleResults]);

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div className="report-modal-title">
            <div className="report-modal-title-row">
              <span className="report-cert-badge"><Award size={15} /> Official Transcript</span>
              <h2>Examination Evaluation Report</h2>
            </div>
            <span>Bright Future Foundation · German Computer-Based Assessment</span>
          </div>
          <div className="report-modal-header-actions">
            <button className="primary-button compact" onClick={() => downloadCompleteReport(profile, selectedTest)}>
              <Download size={15} /> Export HTML
            </button>
            <button className="secondary-button compact" onClick={() => window.print()}>
              <Printer size={15} /> Print / PDF
            </button>
            <button className="icon-close-button" onClick={onClose} aria-label="Close modal">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="report-modal-body">
          {/* Candidate Overview Card */}
          <div className="report-meta-grid">
            <div className="report-meta-item">
              <span className="meta-label">Candidate Name</span>
              <strong className="meta-value">{data.studentName}</strong>
            </div>
            <div className="report-meta-item">
              <span className="meta-label">Paper / Test Title</span>
              <strong className="meta-value">{data.testName}</strong>
            </div>
            <div className="report-meta-item">
              <span className="meta-label">Assessment Level</span>
              <strong className="meta-value">CEFR Level {data.level}</strong>
            </div>
            <div className="report-meta-item">
              <span className="meta-label">Final Evaluation</span>
              <span className={`report-status-badge ${data.percentage >= 60 ? 'status-pass' : 'status-practice'}`}>
                {data.percentage >= 60 ? <Check size={14} style={{ display: 'inline', marginRight: 4 }} /> : <X size={14} style={{ display: 'inline', marginRight: 4 }} />}
                {data.status} ({data.percentage}%)
              </span>
            </div>
          </div>

          {/* Module Score Summary Row */}
          <div className="report-score-cards-row">
            <div className="report-summary-score-card total-score">
              <span className="card-label">Overall Score</span>
              <div className="card-marks">{data.totalObtained} / {data.totalMax}</div>
              <div className="card-progress-bar">
                <div className="card-progress-fill" style={{ width: `${Math.min(100, Math.max(0, data.percentage))}%` }} />
              </div>
              <span className="card-sub">{data.percentage}% Overall Accuracy · {totalCorrectQuestions}/{totalQuestions} Questions</span>
            </div>
            {data.moduleResults.map((m) => {
              if (m.isManualReview) {
                return (
                  <div className="report-summary-score-card" key={m.id}>
                    <span className="card-label">{m.id}</span>
                    <div className="card-marks" style={{ fontSize: '18px', color: '#64748b' }}>Manual Review</div>
                    <div className="card-progress-bar light">
                      <div className="card-progress-fill accent" style={{ width: '0%' }} />
                    </div>
                    <span className="card-sub">Pending Review · Max {m.total} Marks</span>
                  </div>
                );
              }
              const modPct = m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0;
              return (
                <div className="report-summary-score-card" key={m.id}>
                  <span className="card-label">{m.id}</span>
                  <div className="card-marks">{m.correct} / {m.total}</div>
                  <div className="card-progress-bar light">
                    <div className="card-progress-fill accent" style={{ width: `${Math.min(100, Math.max(0, modPct))}%` }} />
                  </div>
                  <span className="card-sub">{modPct}% Score ({m.correct}/{m.total} Marks)</span>
                </div>
              );
            })}
          </div>

          {/* Filter & Module Tabs Toolbar */}
          <div className="report-filter-toolbar">
            <div className="report-module-tabs">
              <button
                className={`report-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Modules ({data.moduleResults.length})
              </button>
              {data.moduleResults.map((m) => (
                <button
                  key={m.id}
                  className={`report-tab-btn ${activeTab === m.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(m.id)}
                >
                  {m.id.charAt(0).toUpperCase() + m.id.slice(1)} ({m.isManualReview ? `Pending / ${m.total} M` : `${m.correct}/${m.total} M`})
                </button>
              ))}
            </div>

            <div className="report-status-filter">
              <span className="filter-label"><Filter size={13} /> Filter:</span>
              <button
                className={`filter-btn ${filterResult === 'all' ? 'active' : ''}`}
                onClick={() => setFilterResult('all')}
              >
                All
              </button>
              <button
                className={`filter-btn filter-btn-pass ${filterResult === 'correct' ? 'active' : ''}`}
                onClick={() => setFilterResult('correct')}
              >
                ✓ Correct
              </button>
              <button
                className={`filter-btn filter-btn-fail ${filterResult === 'incorrect' ? 'active' : ''}`}
                onClick={() => setFilterResult('incorrect')}
              >
                ✗ Incorrect
              </button>
            </div>
          </div>

          {/* Section-by-Section Review */}
          <div className="report-detailed-sections">
            {filteredModules.map((m) => {
              const visibleRows = (m.rows || []).filter((r) => {
                if (filterResult === 'correct') return r.ok;
                if (filterResult === 'incorrect') return !r.ok;
                return true;
              });

              return (
                <div className="report-module-block" key={m.id}>
                  <div className="report-module-block-header">
                    <div>
                      <h3>{m.title}</h3>
                      <span className="report-module-subtext">Module ID: {m.id.toUpperCase()}</span>
                    </div>
                    <span className="report-block-score">
                      {m.isManualReview ? `Pending Faculty Review · Max ${m.total} Marks` : `${m.correct} / ${m.total} Marks`}
                    </span>
                  </div>

                  {visibleRows.length > 0 ? (
                    <div className="report-table-wrap">
                      <table className="report-evaluation-table">
                        <thead>
                          <tr>
                            <th style={{ width: '70px' }}>Frage #</th>
                            <th style={{ width: '32%' }}>Question / Statement</th>
                            <th>Candidate Response</th>
                            <th>Expected Answer Key</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>Marks</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => (
                            <tr key={row.q} className={row.ok ? 'row-pass' : 'row-fail'}>
                              <td><strong className="q-badge">Q{row.q}</strong></td>
                              <td className="cell-prompt">
                                {row.questionText ? row.questionText : <em style={{ color: '#94a3b8' }}>Frage {row.q}</em>}
                              </td>
                              <td className="cell-student">
                                {row.student ? String(row.student) : <span className="empty-response">[No Answer Submitted]</span>}
                              </td>
                              <td className="cell-expected">{row.correct ? String(row.correct) : '-'}</td>
                              <td style={{ textAlign: 'center', fontWeight: '700' }}>
                                <span className={`marks-badge ${row.ok ? 'marks-pass' : 'marks-fail'}`}>
                                  {row.marksObtained} / {row.maxMarks}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`eval-pill ${row.ok ? 'pill-correct' : 'pill-wrong'}`}>
                                  {row.ok ? <><Check size={12} /> Correct</> : <><X size={12} /> Incorrect</>}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : m.rows && m.rows.length > 0 ? (
                    <div className="report-empty-filter-note">
                      No questions matching "{filterResult}" filter in this section.
                    </div>
                  ) : null}

                  {m.textResponse && (
                    <div className="report-writing-review">
                      <div className="writing-review-label">Candidate Written Submission (Faculty Evaluation):</div>
                      <div className="writing-review-content">{m.textResponse}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TestCard({ icon, title, subtitle, text, onClick, status }) {
  const isLocked = Boolean(status);
  const statusText = status?.reason === 'timeExpired' ? 'Time Expired' : 'Submitted';

  return (
    <div className={`portal-module-card ${isLocked ? 'module-completed' : ''}`}>
      <div className="module-card-top">
        <div className="module-icon-wrap">{icon}</div>
        <div className="module-status-indicator">
          {isLocked ? (
            <span className="module-badge completed">
              <CheckCircle2 size={13} /> {statusText}
            </span>
          ) : (
            <span className="module-badge available">Ready to Start</span>
          )}
        </div>
      </div>

      <div className="module-card-body">
        <div className="module-card-heading">
          <h3>{title}</h3>
          <span className="module-card-german-sub">{subtitle}</span>
        </div>
        <p className="module-card-desc">{text}</p>
      </div>

      <div className="module-card-footer">
        <button
          type="button"
          className={isLocked ? 'module-start-btn locked' : 'module-start-btn active'}
          onClick={onClick}
          disabled={isLocked}
        >
          {isLocked ? 'Module Completed' : 'Start Module →'}
        </button>
      </div>
    </div>
  );
}

function isDocumentFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

function useFullscreenWarning() {
  const [isExited, setIsExited] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isDocumentFullscreen()) {
        setIsExited(false);
      } else {
        setIsExited(true);
        enterFullscreen();
      }
    };

    enterFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      exitFullscreen();
    };
  }, []);

  return isExited;
}

function FullscreenLock() {
  return (
    <div className="fullscreen-lock-overlay">
      <div className="fullscreen-lock-card">
        <h2>Full-Screen Required</h2>
        <p>You have exited full-screen mode. The test is locked until you return to full-screen.</p>
        <button className="primary-button" onClick={enterFullscreen}>Return to Full-Screen</button>
      </div>
    </div>
  );
}

function collectAudioSources(section) {
  const sources = [];
  if (section?.audio) sources.push(section.audio);
  (section?.blocks || []).forEach((block) => {
    if (block.audio) sources.push(block.audio);
  });
  return sources;
}

const DEFAULT_READING_SECONDS = 30;

function readingSecondsFor(section, test) {
  const value = Number(section?.readingTimeSeconds ?? test?.readingTimeSeconds ?? DEFAULT_READING_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function ObjectiveExam({ test, testBundle, profile, onBack, onComplete }) {
  const storageKey = answerStorageKey(test);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState(() => getSavedJson(storageKey, {}));
  const submitExam = () => {
    if (!window.confirm('Submit this module? You will not be able to change your answers afterwards.')) return;
    onComplete('submitted');
  };
  const [listeningStarted, setListeningStarted] = useState(false);
  const [playedAudioSrcs, setPlayedAudioSrcs] = useState(() => new Set());
  const [readingRemaining, setReadingRemaining] = useState({});
  const [readingDone, setReadingDone] = useState(() => new Set());
  const listeningNotStarted = test.type === 'listening' && !listeningStarted;
  const perTaskAudio = test.type === 'listening' && test.audioMode === 'perTask';
  const timerDurationMinutes = test.durationMinutes;
  const handleTimeExpired = () => {
    alert('Time is over. This module has been submitted and locked.');
    onComplete('timeExpired');
  };
  const [timeLeft, setTimeLeft] = useCountdownTimer(timerDurationMinutes, listeningNotStarted, handleTimeExpired);
  const section = test.sections[active];
  const isLastSection = active === test.sections.length - 1;
  const singleColumn = test.type === 'listening' || test.type === 'grammar';
  const questionNumbers = useMemo(() => Object.keys(test.answerKey || {}).map(Number).sort((a, b) => a - b), [test.answerKey]);

  const markAudioEnded = (src) => {
    if (!src) return;
    setPlayedAudioSrcs((previous) => (previous.has(src) ? previous : new Set(previous).add(src)));
  };

  const activeSectionAudioSrcs = useMemo(
    () => (perTaskAudio ? collectAudioSources(section) : []),
    [perTaskAudio, section]
  );
  // Reading time: before each part's audio (perTask) or before the single audio file,
  // students get a countdown to read the questions. The exam timer keeps running meanwhile.
  const activeHasUnplayedAudio = activeSectionAudioSrcs.some((src) => !playedAudioSrcs.has(src));
  let readingKey = null;
  if (listeningStarted && perTaskAudio && activeHasUnplayedAudio) readingKey = String(active);
  else if (listeningStarted && test.type === 'listening' && !perTaskAudio && test.audio) readingKey = 'single';
  const readingActive = readingKey != null && !readingDone.has(readingKey);
  const readingInitial = readingKey == null ? 0 : readingSecondsFor(perTaskAudio ? section : null, test);
  const readingLeft = readingKey == null ? 0 : (readingRemaining[readingKey] ?? readingInitial);

  const finishReading = (key) => {
    setReadingDone((previous) => (previous.has(key) ? previous : new Set(previous).add(key)));
  };

  useEffect(() => {
    if (!readingActive) return undefined;
    if (readingLeft <= 0) {
      finishReading(readingKey);
      return undefined;
    }
    const timer = setTimeout(() => {
      setReadingRemaining((previous) => ({ ...previous, [readingKey]: readingLeft - 1 }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [readingActive, readingKey, readingLeft]);

  const currentAudioSrc = useMemo(() => {
    if (!perTaskAudio || !listeningStarted || !readingDone.has(String(active))) return null;
    return activeSectionAudioSrcs.find((src) => !playedAudioSrcs.has(src)) ?? null;
  }, [perTaskAudio, listeningStarted, readingDone, active, activeSectionAudioSrcs, playedAudioSrcs]);

  useEffect(() => saveJson(storageKey, answers), [storageKey, answers]);
  const fullscreenExited = useFullscreenWarning();

  const setAnswer = (q, value) => setAnswers((previous) => ({ ...previous, [q]: value }));
  const reset = () => {
    if (!window.confirm('Clear all answers and restart this module?')) return;
    removeSavedJson(storageKey);
    setAnswers({});
    setTimeLeft(timerDurationMinutes * 60);
    setActive(0);
  };

  return (
    <div className="exam-shell">
      {fullscreenExited && <FullscreenLock />}
      {listeningNotStarted && <ListeningStartOverlay onStart={() => setListeningStarted(true)} />}

      <header className="exam-header branded-header">
        <button className="link-button" onClick={onBack}><ArrowLeft size={18} /> Home</button>
        <div className="exam-title">
          <h1>German Assessment - Level {testBundle?.level || test.level || 'A1'}</h1>
          <span>{MODULE_META[test.type]?.title || 'Practice Module'} • {profile?.studentName || 'Student'}</span>
        </div>
        <div className="timer"><Clock size={18} /> {formatTime(timeLeft)}</div>
      </header>

      <nav className="section-tabs">
        <BrandMark compact />
        {test.sections.map((item, index) => (
          <button key={item.title} className={index === active ? 'active' : ''} onClick={() => setActive(index)}>
            Part {index + 1}<span>{item.title} • {item.source}</span>
          </button>
        ))}
      </nav>

      {test.type === 'listening' && !perTaskAudio && readingActive && (
        <ReadingTimeBanner secondsLeft={readingLeft} onSkip={() => finishReading(readingKey)} />
      )}
      {test.type === 'listening' && !perTaskAudio && (
        <RestrictedAudioPlayer src={test.audio} started={listeningStarted && readingDone.has('single')} />
      )}

      <div className="paper-intro">{String(test.intro || '').replace(/von Kapitel \d+/gi, 'des Tests').replace(/Kapitel \d+/gi, 'diesem Test')}</div>

      <main className={`exam-content ${singleColumn ? 'single-column-layout' : ''} ${test.type === 'listening' ? 'listening-layout' : ''}`}>
        {singleColumn ? (
          <section className="question-panel">
            <div className="section-intro">
              <SectionMeta section={section} />
            </div>
            {perTaskAudio && readingActive && (
              <ReadingTimeBanner secondsLeft={readingLeft} onSkip={() => finishReading(readingKey)} />
            )}
            {perTaskAudio && section.audio && (
              <RestrictedAudioPlayer
                key={section.audio}
                src={section.audio}
                started={section.audio === currentAudioSrc}
                finished={playedAudioSrcs.has(section.audio)}
                onEnded={() => markAudioEnded(section.audio)}
              />
            )}
            {section.blocks.map((block, index) => (
              <QuestionBlock
                key={`${section.title}-${index}`}
                block={block}
                answers={answers}
                setAnswer={setAnswer}
                currentAudioSrc={currentAudioSrc}
                playedAudioSrcs={playedAudioSrcs}
                onAudioEnded={markAudioEnded}
              />
            ))}
          </section>
        ) : (
          <>
            <PassagePanel section={section} />
            <section className="question-panel">
              {hasInputBlanks(section) && !section.blocks?.some((b) => b.type === 'instructionBlock' && b.guidance) && (
                <GuidanceBanner section={section} />
              )}
              {section.blocks.map((block, index) => (
                <QuestionBlock
                  key={`${section.title}-${index}`}
                  block={block}
                  answers={answers}
                  setAnswer={setAnswer}
                />
              ))}
            </section>
          </>
        )}
      </main>

      <footer className="exam-footer">
        <QuestionPalette numbers={questionNumbers} answers={answers} />
        <div className="footer-actions">
          <button type="button" className="secondary-button" onClick={reset}>
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>
          {isLastSection ? (
            <button key="submit-btn" type="button" className="primary-button" onClick={submitExam}>
              <Send size={17} />
              <span>Submit</span>
            </button>
          ) : (
            <button key="next-btn" type="button" className="primary-button" onClick={() => setActive(active + 1)}>
              <span>Next</span>
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function GuidanceBanner({ section, block }) {
  const g = section?.guidance || block?.guidance || getComputedGuidance(section, block);
  if (!g || !g.text) return null;

  return (
    <div className="guidance-banner" role="region" aria-label="Anleitung zur Beantwortung">
      <div className="guidance-header">
        <span className="guidance-badge">
          <HelpCircle size={15} className="guidance-badge-icon" />
          <span>{g.badge || 'Anleitung / How to answer'}</span>
        </span>
        {g.rule && <span className="guidance-rule">{g.rule}</span>}
      </div>
      <div className="guidance-body">
        <p className="guidance-text">{g.text}</p>
        {g.example && (
          <div className="guidance-example-box">
            <span className="example-tag">Beispiel (Practice only):</span>
            <code className="example-content">{g.example}</code>
            {g.exampleNote && <span className="example-note">{g.exampleNote}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function getComputedGuidance(section, block) {
  if (section?.guidance) return section.guidance;

  const sampleBlock = block || section?.blocks?.[0];
  const type = sampleBlock?.type;

  if (type === 'conversationOrdering') {
    return {
      badge: 'Reihenfolge bestimmen / Order sequence',
      text: 'Bringen Sie die Aussagen in die richtige Reihenfolge des Gesprächs (1–15). Wählen Sie für jede Aussage die passende Nummer.',
      rule: 'Jede Zahl nur einmal vergeben',
      example: 'Begrüßung: „Hallo, wie geht\'s?“ -> 1',
      exampleNote: 'Nur die Nummerierung zuordnen.'
    };
  }

  if (type === 'dialogueWordBank') {
    return {
      badge: 'Wortspeicher / Word Bank',
      text: 'Klicken Sie auf ein Verb aus der Liste oder ziehen Sie es per Drag-and-Drop in die passende Lücke des Dialogs.',
      rule: 'Verben in der passenden Form einsetzen',
      example: 'Lücke anklicken oder Verb z.B. „wohnen“ hineinziehen',
      exampleNote: 'Eingesetzte Wörter können durch Klick auf ✕ wieder entfernt werden.'
    };
  }

  if (type === 'choice') {
    const isTrueFalse = sampleBlock?.options && ('richtig' in sampleBlock.options || 'falsch' in sampleBlock.options);
    if (isTrueFalse) {
      return {
        badge: 'Richtig oder Falsch / True or False',
        text: 'Lesen Sie die Aussage und entscheiden Sie anhand des Textes, ob sie zutrifft (Richtig) oder nicht (Falsch).',
        rule: 'Wählen Sie genau eine Option aus',
        example: '(•) Richtig   ( ) Falsch',
        exampleNote: 'Klicken Sie direkt auf die entsprechende Schaltfläche.'
      };
    }
    return {
      badge: 'Einfachauswahl / Multiple Choice',
      text: 'Wählen Sie die eine richtige Antwort aus den vorgegebenen Möglichkeiten (a, b oder c).',
      rule: 'Wählen Sie genau eine Option (Single Choice)',
      example: '( ) a    (•) b    ( ) c',
      exampleNote: 'Klicken Sie auf Ihre gewünschte Antwortoption.'
    };
  }

  if (type === 'textInput') {
    const isWholeSentence = section?.title?.includes('Teil B') || section?.instruction?.toLowerCase()?.includes('ganzen sätzen');
    if (isWholeSentence) {
      return {
        badge: 'Freie Antwort / Sentence Answer',
        text: 'Beantworten Sie die Frage mit Informationen aus dem Text. Sie können in einem ganzen Satz oder mit einem klaren Stichwort antworten.',
        rule: 'Achten Sie auf korrekte deutsche Rechtschreibung und Umlaute (ä, ö, ü, ß)',
        example: 'Frage: „Wo wohnt Peter?“ -> Antwort: Er wohnt in Berlin. (oder: In Berlin)',
        exampleNote: 'Satzzeichen am Ende sind optional und beeinträchtigen die Bewertung nicht.'
      };
    }
    return {
      badge: 'Lückentext / Fill in the blank',
      text: 'Tragen Sie nur das fehlende Wort (oder den kurzen Ausdruck) aus dem Text in das Eingabefeld ein.',
      rule: 'Geben Sie nur die gesuchte Lücke ein – nicht den gesamten Satz wiederholen',
      example: '„Maria kommt aus _____ .“ -> Eingabe: Österreich',
      exampleNote: 'Achten Sie auf Groß- und Kleinschreibung bei Nomen.'
    };
  }

  if (type === 'matching') {
    return {
      badge: 'Zuordnung / Matching',
      text: 'Ordnen Sie die passenden Elemente einander zu. Klicken Sie nacheinander auf beide Partner oder ziehen Sie sie zusammen.',
      rule: '1-zu-1 Zuordnung',
      example: 'Element A -> Passende Zuordnung 1'
    };
  }

  return null;
}

function hasInputBlanks(section) {
  if (!section || !Array.isArray(section.blocks)) return false;
  return section.blocks.some((b) => {
    if (b.type === 'textInput' || b.type === 'multiTextInput') {
      const isWholeSentence =
        section.title?.includes('Teil B') ||
        section.instruction?.toLowerCase()?.includes('ganzen sätzen');
      return !isWholeSentence;
    }
    return false;
  });
}

function SectionMeta({ section, showGuidance = true }) {
  const isInputBlanksSection = hasInputBlanks(section);
  const instruction = isInputBlanksSection
    ? (section.instruction || (section.documents ? section.passage : null))
    : null;
  const passageText = !section.documents && section.passage ? section.passage : null;
  // If instruction is identical to passageText, only render it once as the instruction box, not as duplicate text block
  const displayPassageText = passageText && passageText.trim() !== instruction?.trim() ? passageText : null;

  return (
    <>
      <p className="panel-kicker">{section.title}</p>
      <h2>{section.passageTitle}</h2>
      {instruction && <div className="instruction-box german-instruction">{instruction}</div>}
      {showGuidance && isInputBlanksSection && <GuidanceBanner section={section} />}
      {section.image && (
        <figure className="question-media-figure">
          <img src={section.image} alt={section.passageTitle || section.title} draggable="false" />
        </figure>
      )}
      {displayPassageText && (
        <article className="reading-document">
          <div className="reading-document-head">
            <span>{section.passageTitle || 'Lesetext'}</span>
            <small>{section.source || 'Text'}</small>
          </div>
          <div className="reading-document-text">{displayPassageText}</div>
        </article>
      )}
      {section.documents?.map((document) => (
        <article className="reading-document" key={document.title}>
          <div className="reading-document-head">
            <span>{document.title}</span>
            <small>{document.kind}</small>
          </div>
          <div className="reading-document-text">{document.text}</div>
        </article>
      ))}
    </>
  );
}

function PassagePanel({ section }) {
  return (
    <aside className="passage-panel german-passage-panel">
      <SectionMeta section={section} showGuidance={false} />
    </aside>
  );
}

function ListeningStartOverlay({ onStart }) {
  return (
    <div className="listening-start-overlay">
      <div className="listening-start-card">
        <span className="listening-start-icon"><Headphones size={26} /></span>
        <h2>Listening Test</h2>
        <p>Click play to start your listening.</p>
        <button className="primary-button" onClick={onStart}><Play size={18} /> Play</button>
        <small>You will get reading time before each audio. Once an audio starts it cannot be paused.</small>
      </div>
    </div>
  );
}

function ReadingTimeBanner({ secondsLeft, onSkip }) {
  return (
    <div className="audio-bar reading-time-bar">
      <div>
        <strong>Reading time · {formatTime(secondsLeft)}</strong>
        <p>Read the questions now. The audio starts automatically when the countdown ends.</p>
      </div>
      <button className="secondary-button" onClick={onSkip}><Play size={17} /> Start audio now</button>
    </div>
  );
}

function RestrictedAudioPlayer({ src, started = false, onDuration = () => { }, onEnded = () => { }, finished = false }) {
  const audioRef = useRef(null);
  const maxAllowedTime = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!started) return;
    const audio = audioRef.current;
    audio?.play().catch(() => { });
  }, [started]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > maxAllowedTime.current + 1.2) {
      audio.currentTime = maxAllowedTime.current;
      return;
    }
    maxAllowedTime.current = Math.max(maxAllowedTime.current, audio.currentTime);
    setElapsed(audio.currentTime);
  };

  const preventPause = () => {
    const audio = audioRef.current;
    if (!audio || !started || audio.ended) return;
    audio.play().catch(() => { });
  };

  return (
    <div className="audio-bar restricted-audio">
      <div>
        <strong>Listening audio</strong>
        <p>The audio plays automatically and cannot be paused, rewound or downloaded.</p>
      </div>
      <div className="audio-controls">
        <span className="audio-status">{finished ? 'Already played' : started ? '🔊 Playing' : 'Waiting to start'} · {formatTime(elapsed)} / {duration ? formatTime(duration) : '--:--'}</span>
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          controls={false}
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          onEnded={() => onEnded()}
          onLoadedMetadata={(event) => {
            const loadedDuration = event.currentTarget.duration || 0;
            setDuration(loadedDuration);
            if (loadedDuration > 0) onDuration(loadedDuration);
          }}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={() => {
            const audio = audioRef.current;
            if (audio) audio.currentTime = maxAllowedTime.current;
          }}
          onPause={preventPause}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
    </div>
  );
}

function QuestionBlock({ block, answers, setAnswer, currentAudioSrc = null, playedAudioSrcs, onAudioEnded = () => { } }) {
  if (block.type === 'instructionBlock') {
    return (
      <div className="question-instruction-block" style={{ margin: '14px 0' }}>
        {block.text && <div className="instruction-box german-instruction">{block.text}</div>}
        {block.guidance && <GuidanceBanner block={block} />}
      </div>
    );
  }
  if (block.type === 'sectionLabel') return <div className="question-section-label">{block.text}</div>;
  if (block.type === 'noteCompletion') return <NoteCompletionQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'conversationOrdering') {
    return (
      <ConversationOrderingQuestion
        block={block}
        answers={answers}
        setAnswer={setAnswer}
        started={Boolean(block.audio) && block.audio === currentAudioSrc}
        finished={Boolean(block.audio) && Boolean(playedAudioSrcs?.has(block.audio))}
        onAudioEnded={() => onAudioEnded(block.audio)}
      />
    );
  }
  if (block.type === 'exampleImageChoice') return <ImageChoice block={block} example />;
  if (block.type === 'imageChoice') return <ImageChoice block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'exampleChoice') return <ChoiceQuestion block={block} example />;
  if (block.type === 'choice') return <ChoiceQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'exampleSourceChoice') return <SourceChoice block={block} example />;
  if (block.type === 'sourceChoice') return <SourceChoice block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'exampleNoticeChoice') return <NoticeChoice block={block} example />;
  if (block.type === 'noticeChoice') return <NoticeChoice block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'exampleTextInput') return <TextInputQuestion block={block} example />;
  if (block.type === 'textInput') return <TextInputQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'multiTextInput') return <MultiTextInputQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'crossword') return <CrosswordQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'wordSearch') return <WordSearchQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'matching') return <MatchingQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'dialogueWordBank') return <DialogueWordBankQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'imageDialogueRow') return <ImageDialogueRowQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'imageGridInputs') return <ImageGridInputsQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'sentenceGaps') return <SentenceGapsQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  if (block.type === 'imageOrderingDrop') return <ImageOrderingDropQuestion block={block} answers={answers} setAnswer={setAnswer} />;
  return null;
}

function MatchingQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const [picked, setPicked] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const exampleAnswer = block.example?.answerId;
  const rightById = Object.fromEntries(block.rightItems.map((item) => [item.id, item]));
  const valueFor = (q) => (typeof answers[q] === 'string' && rightById[answers[q]] ? answers[q] : '');
  const assignedTo = {};
  block.leftItems.forEach((item) => {
    if (valueFor(item.q)) assignedTo[valueFor(item.q)] = item.q;
  });

  const place = (q, rightId) => {
    setPicked(null);
    setDragTarget(null);
    if (!rightById[rightId] || rightId === exampleAnswer) return;
    const previousQ = assignedTo[rightId];
    if (previousQ && previousQ !== q) setAnswer(previousQ, '');
    setAnswer(q, rightId);
  };
  const unplace = (rightId) => {
    setDragTarget(null);
    if (assignedTo[rightId]) setAnswer(assignedTo[rightId], '');
  };
  const dropHandlers = (target, onDrop) => ({
    onDragOver: (event) => { event.preventDefault(); setDragTarget(target); },
    onDragLeave: () => setDragTarget((current) => (current === target ? null : current)),
    onDrop: (event) => { event.preventDefault(); onDrop(event.dataTransfer.getData('text/plain')); }
  });
  const startDrag = (rightId) => (event) => {
    event.dataTransfer.setData('text/plain', rightId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const renderCard = (rightId, { draggable = false, locked = false } = {}) => (
    <div
      className={`matching-answer ${locked ? 'locked' : ''} ${picked === rightId ? 'picked' : ''}`}
      draggable={draggable}
      onDragStart={draggable ? startDrag(rightId) : undefined}
    >
      <span className="choice-key">{rightId}</span>
      <span>{rightById[rightId]?.text}</span>
    </div>
  );

  return (
    <div className="question-card matching-card">
      <p><strong>{block.title}</strong></p>
      <p className="matching-hint">Drag an answer onto a question, or click an answer and then click a question.</p>
      <div className="matching-layout">
        <div className="matching-questions">
          {block.example && (
            <div className="matching-row example-row">
              <p><strong>Beispiel</strong> {block.example.text}</p>
              <div className="matching-slot filled">
                {renderCard(block.example.answerId, { locked: true })}
              </div>
            </div>
          )}
          {block.leftItems.map((item) => {
            const value = valueFor(item.q);
            return (
              <div className="matching-row" id={`q-${item.q}`} key={item.id}>
                <p><strong>{item.q}.</strong> {item.text}</p>
                <div
                  className={`matching-slot ${value ? 'filled' : ''} ${dragTarget === item.q ? 'drag-over' : ''} ${picked ? 'awaiting' : ''}`}
                  onClick={() => picked && place(item.q, picked)}
                  {...dropHandlers(item.q, (rightId) => place(item.q, rightId))}
                >
                  {value ? (
                    <>
                      {renderCard(value, { draggable: true })}
                      <button
                        type="button"
                        className="matching-clear"
                        aria-label="Remove answer"
                        onClick={(event) => { event.stopPropagation(); setAnswer(item.q, ''); }}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="matching-placeholder">Drop answer here</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div
          className={`matching-pool ${dragTarget === 'pool' ? 'drag-over' : ''}`}
          {...dropHandlers('pool', unplace)}
        >
          {block.rightItems.map((item) => {
            const isExample = item.id === exampleAnswer;
            const used = isExample || Boolean(assignedTo[item.id]);
            return (
              <div
                key={item.id}
                className={`matching-pool-item ${used ? 'used' : ''}`}
                onClick={() => !used && setPicked((current) => (current === item.id ? null : item.id))}
              >
                {renderCard(item.id, { draggable: !used, locked: used })}
                {isExample && <span className="matching-tag">Beispiel</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TextInputQuestion({ block, answers = {}, setAnswer = () => { }, example = false }) {
  const value = example ? block.answer : (answers[block.q] || '');
  return (
    <div className={`question-card ${example ? 'example-card' : ''}`} id={example ? undefined : `q-${block.q}`}>
      {block.image && (
        <div className="question-block-image" style={{ marginBottom: '12px' }}>
          <img
            src={block.image}
            alt={block.prompt || `Frage ${block.q}`}
            style={{ maxHeight: '140px', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
            draggable="false"
          />
        </div>
      )}
      <p><strong>{example ? 'Beispiel 0' : `${block.q}.`}</strong> {stripLeadingNumber(block.prompt)}</p>
      <input
        type="text"
        className="text-input-answer"
        value={value}
        onChange={(event) => setAnswer(block.q, event.target.value)}
        placeholder={block.placeholder || ''}
        autoComplete="off"
        disabled={example}
      />
      {example && <span className="example-label">Beispiel</span>}
    </div>
  );
}

function ImageDialogueRowQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const rows = block.rows || [];
  return (
    <div className="image-dialogue-rows-container">
      {rows.map((row) => (
        <div className="image-dialogue-row-card" key={row.id || row.label}>
          <div className="image-dialogue-badge-col">
            {row.image && (
              <img
                src={row.image}
                alt={row.label ? `Bild ${row.label}` : 'Illustration'}
                className="image-dialogue-thumb"
                draggable="false"
              />
            )}
            {row.label && <span className="image-dialogue-badge-num">{row.label}</span>}
          </div>
          <div className="image-dialogue-content-col">
            {(row.lines || []).map((line, lIdx) => {
              if (line.q == null) {
                return (
                  <div className="image-dialogue-plain-line" key={lIdx}>
                    {line.text}
                  </div>
                );
              }
              const parts = (line.text || '').split('______');
              const before = parts[0] || '';
              const after = parts[1] || '';
              return (
                <div className="image-dialogue-input-line" key={line.q} id={`q-${line.q}`}>
                  <span className="image-dialogue-qnum">{line.q}.</span>
                  {before && <span className="image-dialogue-text-before">{before}</span>}
                  <input
                    type="text"
                    className="text-input-answer inline-gap-input"
                    value={answers[line.q] || ''}
                    onChange={(e) => setAnswer(line.q, e.target.value)}
                    placeholder="..."
                    autoComplete="off"
                  />
                  {after && <span className="image-dialogue-text-after">{after}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageGridInputsQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const items = block.items || [];
  return (
    <div className="image-grid-inputs-container">
      <div className="image-grid-inputs-row">
        {items.map((item) => {
          const promptParts = (item.prompt || '').split('______');
          const prefix = promptParts[0] || '';
          const suffix = promptParts[1] || '';
          return (
            <div className="image-grid-input-card" key={item.q} id={`q-${item.q}`}>
              {item.badge && <span className="image-grid-badge-top">{item.badge}</span>}
              {item.image && (
                <div className="image-grid-thumb-box">
                  <img src={item.image} alt={item.prompt || `Bild ${item.badge || item.q}`} draggable="false" />
                </div>
              )}
              <div className="image-grid-input-control">
                {prefix && <span className="image-grid-prefix">{prefix}</span>}
                <input
                  type="text"
                  className="text-input-answer image-grid-input"
                  value={answers[item.q] || ''}
                  onChange={(e) => setAnswer(item.q, e.target.value)}
                  placeholder="..."
                  autoComplete="off"
                />
                {suffix && <span className="image-grid-suffix">{suffix}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SentenceGapsQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const sentences = block.sentences || [];
  return (
    <div className="sentence-gaps-container">
      {block.instructionBanner && (
        <div className="sentence-gaps-banner">
          {block.instructionBanner}
        </div>
      )}
      <div className="sentence-gaps-card">
        {block.cardTitle && (
          <h3 className="sentence-gaps-card-title">{block.cardTitle}</h3>
        )}
        <div className="sentence-gaps-body">
          {sentences.map((sent, sIdx) => {
            if (sent.isSpacer) {
              return <div className="sentence-gap-spacer" key={sIdx} />;
            }
            return (
              <div className="sentence-gap-line" key={sIdx}>
                {(sent.segments || []).map((seg, segIdx) => {
                  if (seg.text !== undefined && seg.q === undefined) {
                    return <span key={segIdx} className="sentence-gap-plain-text">{seg.text}</span>;
                  }
                  return (
                    <span key={segIdx} className="sentence-gap-inline-wrapper" id={`q-${seg.q}`}>
                      {seg.q !== undefined && <span className="sentence-gap-badge">{seg.q}</span>}
                      {seg.prefix && <span className="sentence-gap-prefix">{seg.prefix}</span>}
                      <input
                        type="text"
                        className="text-input-answer sentence-gap-underline-input"
                        value={answers[seg.q] || ''}
                        onChange={(e) => setAnswer(seg.q, e.target.value)}
                        placeholder={seg.placeholder || 'answer'}
                        autoComplete="off"
                      />
                      {seg.suffix && <span className="sentence-gap-suffix">{seg.suffix}</span>}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ImageOrderingDropQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const images = block.images || [];
  const slots = block.slots || [];
  const [selectedImgId, setSelectedImgId] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // Mode check:
  // Mode A (Unit 9): each image has img.q, slots have slot.value ("1"-"6"). answers[img.q] = slot.value
  // Mode B (Unit 11): each slot has slot.q (1-7), images have img.value ("2"-"8"). answers[slot.q] = img.value
  const isSlotQuestionMode = slots.some((s) => s.q != null);

  const slotAssignments = {}; // { slotKey: imageObj }
  const assignedImageIds = new Set();

  if (isSlotQuestionMode) {
    slots.forEach((slot) => {
      const val = answers[slot.q];
      if (val) {
        const foundImg = images.find((im) => String(im.value || im.id) === String(val));
        if (foundImg) {
          slotAssignments[String(slot.value)] = foundImg;
          assignedImageIds.add(foundImg.id);
        }
      }
    });
  } else {
    images.forEach((img) => {
      const val = answers[img.q];
      if (val) {
        slotAssignments[String(val)] = img;
        assignedImageIds.add(img.id);
      }
    });
  }

  const handleDragStart = (e, imgId) => {
    e.dataTransfer.setData('text/plain', imgId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const assignImageToSlot = (imgId, slotValue) => {
    const targetImg = images.find((im) => im.id === imgId);
    if (!targetImg) return;

    if (isSlotQuestionMode) {
      const targetSlot = slots.find((s) => String(s.value) === String(slotValue));
      if (!targetSlot) return;

      // If this image was already assigned to another slot, clear that slot
      slots.forEach((s) => {
        if (String(answers[s.q]) === String(targetImg.value || targetImg.id)) {
          setAnswer(s.q, '');
        }
      });

      // Assign image value to this slot's question
      setAnswer(targetSlot.q, String(targetImg.value || targetImg.id));
    } else {
      // If another image was in this slot, clear that image's answer
      const currentOccupant = slotAssignments[slotValue];
      if (currentOccupant && currentOccupant.id !== imgId) {
        setAnswer(currentOccupant.q, '');
      }

      // Set target image's answer to this slot
      setAnswer(targetImg.q, String(slotValue));
    }

    setSelectedImgId(null);
    setDragOverSlot(null);
  };

  const removeImageFromSlot = (slotValue, occupantImg) => {
    if (isSlotQuestionMode) {
      const targetSlot = slots.find((s) => String(s.value) === String(slotValue));
      if (targetSlot) {
        setAnswer(targetSlot.q, '');
      }
    } else if (occupantImg) {
      setAnswer(occupantImg.q, '');
    }
    if (occupantImg && selectedImgId === occupantImg.id) setSelectedImgId(null);
  };

  const handleDrop = (e, slotValue) => {
    e.preventDefault();
    setDragOverSlot(null);
    const imgId = e.dataTransfer.getData('text/plain');
    if (imgId) {
      assignImageToSlot(imgId, slotValue);
    }
  };

  const handleSlotClick = (slotValue) => {
    if (selectedImgId) {
      assignImageToSlot(selectedImgId, slotValue);
    }
  };

  const handleImageClick = (img) => {
    if (assignedImageIds.has(img.id)) return;
    setSelectedImgId((prev) => (prev === img.id ? null : img.id));
  };

  return (
    <div className="image-ordering-drop-container">
      {block.instruction && (
        <div className="instruction-box german-instruction" style={{ marginBottom: '16px' }}>
          {block.instruction}
        </div>
      )}

      {/* Pool of draggable images */}
      <div className="image-pool-section">
        <div className="image-pool-header">
          <span className="image-pool-title">{block.poolTitle || 'Bilder (Klicken oder Ziehen):'}</span>
          {selectedImgId && (
            <span className="image-pool-selected-hint">
              Ausgewählt: <strong>{images.find((im) => im.id === selectedImgId)?.label || `Bild ${selectedImgId.toUpperCase()}`}</strong> – Klicke auf ein Zielfeld unten
            </span>
          )}
        </div>
        <div
          className="image-pool-grid"
          style={block.columns ? { gridTemplateColumns: `repeat(${block.columns}, 1fr)` } : undefined}
        >
          {images.map((img) => {
            const isAssigned = assignedImageIds.has(img.id);
            const isSelected = selectedImgId === img.id;
            return (
              <div
                key={img.id}
                className={`image-pool-card ${isAssigned ? 'assigned' : ''} ${isSelected ? 'selected' : ''}`}
                draggable={!isAssigned}
                onDragStart={(e) => !isAssigned && handleDragStart(e, img.id)}
                onClick={() => handleImageClick(img)}
              >
                <div className="image-card-badge">{img.label || `Bild ${img.id.toUpperCase()}`}</div>
                <div className="image-card-thumb-wrap">
                  <img src={img.src} alt={img.label || `Bild ${img.id}`} draggable="false" />
                </div>
                {isAssigned && <div className="image-assigned-overlay">✓ Platziert</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Target exercise slots */}
      <div className="image-slots-section">
        <div className="image-slots-header">
          <span className="image-slots-title">{block.slotsTitle || 'Übungen (Reihenfolge):'}</span>
        </div>
        <div
          className="image-slots-grid"
          style={block.columns ? { gridTemplateColumns: `repeat(${block.columns}, 1fr)` } : undefined}
        >
          {block.example && (
            <div className="image-slot-card has-image example-slot">
              <div className="slot-badge example-badge">{block.example.label || 'Beispiel: 1. der Koffer'}</div>
              <div className="slot-dropzone">
                <div className="slot-placed-image-wrap">
                  <img src={block.example.src} alt={block.example.label || 'Beispiel'} draggable="false" />
                  <div className="slot-placed-label">{block.example.imageLabel || 'Gegenstand 1'}</div>
                  <span className="example-lock-tag">Beispiel</span>
                </div>
              </div>
            </div>
          )}
          {slots.map((slot) => {
            const occupant = slotAssignments[slot.value];
            const isDragOver = dragOverSlot === slot.value;
            return (
              <div
                key={slot.value}
                className={`image-slot-card ${occupant ? 'has-image' : 'empty'} ${isDragOver ? 'drag-over' : ''} ${selectedImgId && !occupant ? 'ready-to-place' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverSlot(slot.value);
                }}
                onDragLeave={() => setDragOverSlot((curr) => (curr === slot.value ? null : curr))}
                onDrop={(e) => handleDrop(e, slot.value)}
                onClick={() => handleSlotClick(slot.value)}
                id={occupant ? `q-${occupant.q}` : undefined}
              >
                <div className="slot-badge">{slot.label}</div>
                <div className="slot-dropzone">
                  {occupant ? (
                    <div className="slot-placed-image-wrap">
                      <img src={occupant.src} alt={occupant.label} draggable="false" />
                      <div className="slot-placed-label">{occupant.label}</div>
                      <button
                        type="button"
                        className="slot-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImageFromSlot(slot.value, occupant);
                        }}
                        title="Bild entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="slot-empty-placeholder">
                      <span className="slot-empty-plus">+</span>
                      <span className="slot-empty-text">Hier ablegen</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MultiTextInputQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const fields = block.fields || [];
  const existing = answers[block.q];
  const values = Array.isArray(existing)
    ? existing
    : existing && typeof existing === 'object'
      ? fields.map((field) => existing[field.id] || '')
      : String(existing || '').split('|').map((value) => value.trim());

  const updateField = (index, value) => {
    const next = fields.map((_, fieldIndex) => values[fieldIndex] || '');
    next[index] = value;
    setAnswer(block.q, next.join(block.answerJoiner || ' | '));
  };

  return (
    <div className="question-card" id={`q-${block.q}`}>
      <p><strong>{block.q}.</strong> {stripLeadingNumber(block.prompt)}</p>
      <div className="multi-text-inputs">
        {fields.map((field, index) => (
          <div className="multi-text-field" key={field.id || index}>
            <span className="multi-text-field-label">{field.placeholder || `${index + 1}. Lücke`}</span>
            {Array.isArray(field.choices) && field.choices.length > 0 ? (
              <div className="choice-grid multi-text-choice-grid">
                {field.choices.map((choice) => (
                  <label key={choice} className={values[index] === choice ? 'choice selected' : 'choice'}>
                    <input
                      type="radio"
                      name={`q-${block.q}-${field.id || index}`}
                      value={choice}
                      checked={values[index] === choice}
                      onChange={() => updateField(index, choice)}
                    />
                    <span>{choice}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                className="text-input-answer"
                value={values[index] || ''}
                onChange={(event) => updateField(index, event.target.value)}
                placeholder={field.placeholder || ''}
                autoComplete="off"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteCompletionQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const raw = answers[block.q];
  const noInfo = raw === NO_INFORMATION_VALUE;
  const value = noInfo ? '' : (raw || '');

  return (
    <div className="question-card" id={`q-${block.q}`}>
      <p><strong>{block.q}.</strong> {stripLeadingNumber(block.prompt)}</p>
      <input
        type="text"
        className="text-input-answer"
        value={value}
        onChange={(event) => setAnswer(block.q, event.target.value)}
        placeholder={block.field || ''}
        autoComplete="off"
        disabled={noInfo}
      />
      {block.allowNoInformation && (
        <label className="note-completion-no-info">
          <input
            type="checkbox"
            checked={noInfo}
            onChange={(event) => setAnswer(block.q, event.target.checked ? NO_INFORMATION_VALUE : '')}
          />
          <span>Keine Information</span>
        </label>
      )}
    </div>
  );
}

function ConversationOrderingQuestion({ block, answers = {}, setAnswer = () => { }, started = false, finished = false, onAudioEnded = () => { } }) {
  const items = block.items || [];
  // Per-item mode: each line has its own question number and stores its position as a string.
  const perItem = items.some((item) => item.q != null);
  const existing = Array.isArray(answers[block.q]) ? answers[block.q] : [];
  const positionFor = (id) => {
    if (perItem) {
      const item = items.find((entry) => entry.id === id);
      if (item?.example) return String(item.position);
      return typeof answers[item?.q] === 'string' ? answers[item.q] : '';
    }
    const index = existing.indexOf(id);
    return index === -1 ? '' : String(index + 1);
  };

  const setPosition = (id, position) => {
    if (perItem) {
      const item = items.find((entry) => entry.id === id);
      if (!item || item.example) return;
      // A position can only belong to one line: free it from any other line first.
      if (position) {
        items.forEach((other) => {
          if (other.q != null && other.id !== id && answers[other.q] === position) setAnswer(other.q, '');
        });
      }
      setAnswer(item.q, position);
      return;
    }
    const ordered = Array(items.length).fill(null);
    items.forEach((item) => {
      const currentPos = item.id === id ? position : positionFor(item.id);
      const positionIndex = Number(currentPos) - 1;
      if (currentPos && positionIndex >= 0 && positionIndex < ordered.length && ordered[positionIndex] == null) {
        ordered[positionIndex] = item.id;
      }
    });
    setAnswer(block.q, ordered);
  };

  const columns = block.columns || 1;
  const examplePositions = new Set(items.filter((item) => item.example).map((item) => String(item.position)));
  const positionOptions = items
    .map((_, index) => String(index + 1))
    .filter((position) => !perItem || !examplePositions.has(position));

  const renderItem = (item) => (
    <div
      className={`conversation-ordering-item ${item.speaker ? `speaker-${item.speaker}` : ''} ${item.example ? 'example-item' : ''}`}
      key={item.id}
      id={item.q != null ? `q-${item.q}` : undefined}
    >
      {item.speaker && (
        <span className={`dialog-speech-bubble bubble-${item.speaker}`} title={item.speakerName || item.speaker} aria-hidden="true" />
      )}
      {perItem && <span className="ordering-item-qnum">{item.example ? '' : `${item.q}.`}</span>}
      <select
        value={positionFor(item.id)}
        onChange={(event) => setPosition(item.id, event.target.value)}
        disabled={Boolean(item.example)}
        aria-label={`Position für: ${item.text}`}
      >
        <option value="">__</option>
        {item.example && <option value={String(item.position)}>{item.position}</option>}
        {positionOptions.map((position) => (
          <option key={position} value={position}>{position}</option>
        ))}
      </select>
      <span className="ordering-item-text">{item.text}</span>
      {item.example && <span className="matching-tag">Beispiel</span>}
    </div>
  );

  return (
    <div className={`question-card conversation-ordering-card ${columns === 2 ? 'two-column-dialog' : ''}`} id={perItem ? undefined : `q-${block.q}`}>
      <p>{!perItem && <strong>{block.q}. </strong>}{block.title || 'Gespräch'}</p>
      {block.audio && (
        <RestrictedAudioPlayer key={block.audio} src={block.audio} started={started} finished={finished} onEnded={onAudioEnded} />
      )}
      {columns === 2 ? (
        <div className="ordering-two-columns">
          <div className="ordering-column ordering-column-left">
            {items.filter((item) => item.column !== 'right').map(renderItem)}
          </div>
          <div className="ordering-column ordering-column-right">
            {items.filter((item) => item.column === 'right').map(renderItem)}
          </div>
        </div>
      ) : (
        <div className="conversation-ordering-list">
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
}

function DialogueWordBankQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const wordBank = block.wordBank || [];
  const lines = block.lines || [];
  const [picked, setPicked] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const valueFor = (q) => (wordBank.includes(answers[q]) ? answers[q] : '');
  const assignedTo = {};
  lines.forEach((line) => {
    if (line.q && valueFor(line.q)) assignedTo[valueFor(line.q)] = line.q;
  });

  const place = (q, word) => {
    setPicked(null);
    setDragTarget(null);
    if (!wordBank.includes(word)) return;
    const previousQ = assignedTo[word];
    if (previousQ && previousQ !== q) setAnswer(previousQ, '');
    setAnswer(q, word);
  };
  const unplace = (word) => {
    setDragTarget(null);
    if (assignedTo[word]) setAnswer(assignedTo[word], '');
  };
  const dropHandlers = (target, onDrop) => ({
    onDragOver: (event) => { event.preventDefault(); setDragTarget(target); },
    onDragLeave: () => setDragTarget((current) => (current === target ? null : current)),
    onDrop: (event) => { event.preventDefault(); onDrop(event.dataTransfer.getData('text/plain')); }
  });
  const startDrag = (word) => (event) => {
    event.dataTransfer.setData('text/plain', word);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="question-card dialogue-wordbank-card">
      <div className="dragdrop-notice">
        <strong>Drag and drop</strong>
        <span>You have to answer by dragging each word from the Wortschatz into the correct gap. (You can also click a word, then click a gap.)</span>
      </div>
      {/* Word Bank Box */}
      <div
        className={`wordbank-header ${dragTarget === 'bank' ? 'drag-over' : ''}`}
        {...dropHandlers('bank', unplace)}
      >
        <span className="wordbank-label">Wortschatz</span>
        <div className="wordbank-chips">
          {wordBank.map((word) => {
            const used = Boolean(assignedTo[word]);
            return (
              <span
                key={word}
                className={`wordbank-chip ${used ? 'used' : ''} ${picked === word ? 'picked' : ''}`}
                draggable={!used}
                onDragStart={used ? undefined : startDrag(word)}
                onClick={() => !used && setPicked((current) => (current === word ? null : word))}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>

      {/* Dialogue Lines */}
      <div className="dialogue-fill-list">
        {lines.map((line, idx) => {
          if (!line.q) {
            return (
              <div className="dialogue-fill-row dialogue-fill-row-plain" key={`plain-${idx}`}>
                <span className="dialogue-fill-speaker">{line.speaker}:</span>
                <span className="dialogue-fill-sentence">{line.text}</span>
              </div>
            );
          }
          const value = valueFor(line.q);
          return (
            <div className="dialogue-fill-row" key={line.q} id={`q-${line.q}`}>
              <span className="dialogue-fill-speaker">{line.speaker}:</span>
              <span className="dialogue-fill-sentence">
                {line.before}
                <span
                  className={`dialogue-fill-slot ${value ? 'filled' : ''} ${dragTarget === line.q ? 'drag-over' : ''} ${picked ? 'awaiting' : ''}`}
                  aria-label={`Frage ${line.q}`}
                  onClick={() => picked && place(line.q, picked)}
                  {...dropHandlers(line.q, (word) => place(line.q, word))}
                >
                  {value ? (
                    <>
                      <span className="dialogue-fill-word" draggable onDragStart={startDrag(value)}>{value}</span>
                      <button
                        type="button"
                        className="dialogue-fill-clear"
                        aria-label="Remove word"
                        onClick={(event) => { event.stopPropagation(); setAnswer(line.q, ''); }}
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="dialogue-fill-placeholder">______</span>
                  )}
                </span>
                {line.after}
              </span>
              <span className="dialogue-fill-qnum">({line.q})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceQuestion({ block, answers = {}, setAnswer = () => { }, example = false }) {
  const selected = example ? block.answer : (answers[block.q] || '');
  return (
    <div className={`question-card ${example ? 'example-card' : ''}`} id={example ? undefined : `q-${block.q}`}>
      <p><strong>{example ? 'Beispiel 0' : `${block.q}.`}</strong> {stripLeadingNumber(block.prompt)}</p>
      <div className="choice-grid german-choice-grid">
        {Object.entries(block.options).map(([key, text]) => (
          <label key={key} className={selected === key ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name={`${example ? 'example' : 'q'}-${block.q ?? block.prompt}`}
              value={key}
              checked={selected === key}
              disabled={example}
              onChange={(event) => setAnswer(block.q, event.target.value)}
            />
            {key !== text && !['richtig', 'falsch', 'ja', 'nein'].includes(key.toLowerCase()) && (
              <span className="choice-key">{key}</span>
            )}
            <span>{text}</span>
          </label>
        ))}
      </div>
      {example && <span className="example-label">Beispiel</span>}
    </div>
  );
}

function ImageChoice({ block, answers = {}, setAnswer = () => { }, example = false }) {
  const selected = example ? block.answer : (answers[block.q] || '');
  return (
    <div className={`question-card image-choice-card ${example ? 'example-card' : ''}`} id={example ? undefined : `q-${block.q}`}>
      <p><strong>{example ? 'Beispiel 0' : `${block.q}.`}</strong> {stripLeadingNumber(block.prompt)}</p>
      <div className="image-choice-grid">
        {Object.entries(block.options).map(([key, option]) => (
          <label key={key} className={selected === key ? 'image-choice selected' : 'image-choice'}>
            <input
              type="radio"
              name={`${example ? 'example-image' : 'q'}-${block.q ?? block.prompt}`}
              value={key}
              checked={selected === key}
              disabled={example}
              onChange={(event) => setAnswer(block.q, event.target.value)}
            />
            <img src={option.image} alt={option.text} draggable="false" />
            <span className="image-choice-caption"><strong>{key}</strong> {option.text}</span>
          </label>
        ))}
      </div>
      {example && <span className="example-label">Beispiel</span>}
    </div>
  );
}

function SourceChoice({ block, answers = {}, setAnswer = () => { }, example = false }) {
  const selected = example ? block.answer : (answers[block.q] || '');
  return (
    <div className={`question-card source-question-card ${example ? 'example-card' : ''}`} id={example ? undefined : `q-${block.q}`}>
      <p><strong>{example ? 'Beispiel 0' : `${block.q}.`}</strong> {stripLeadingNumber(block.prompt)}</p>
      <div className="source-choice-grid">
        {Object.entries(block.sources).map(([key, source]) => (
          <label key={key} className={selected === key ? 'source-option selected' : 'source-option'}>
            <input
              type="radio"
              name={`${example ? 'example-source' : 'q'}-${block.q ?? block.prompt}`}
              value={key}
              checked={selected === key}
              disabled={example}
              onChange={(event) => setAnswer(block.q, event.target.value)}
            />
            <div className="source-card">
              <div className="source-card-title">{source.title}</div>
              <div className="source-card-text">{source.text}</div>
            </div>
            <span className="source-letter">{key}</span>
          </label>
        ))}
      </div>
      {example && <span className="example-label">Beispiel</span>}
    </div>
  );
}

function NoticeChoice({ block, answers = {}, setAnswer = () => { }, example = false }) {
  const selected = example ? block.answer : (answers[block.q] || '');
  return (
    <div className={`question-card notice-question-card ${example ? 'example-card' : ''}`} id={example ? undefined : `q-${block.q}`}>
      <p className="notice-location"><strong>{example ? 'Beispiel 0' : `${block.q}.`}</strong> {block.location}</p>
      <div className="notice-card-german">
        <strong>{block.noticeTitle}</strong>
        <div>{block.notice}</div>
      </div>
      <p className="notice-statement">{block.prompt}</p>
      <div className="choice-grid german-choice-grid compact-choice-grid">
        {['richtig', 'falsch'].map((key) => (
          <label key={key} className={selected === key ? 'choice selected' : 'choice'}>
            <input
              type="radio"
              name={`${example ? 'example-notice' : 'q'}-${block.q ?? block.prompt}`}
              value={key}
              checked={selected === key}
              disabled={example}
              onChange={(event) => setAnswer(block.q, event.target.value)}
            />
            <span>{key}</span>
          </label>
        ))}
      </div>
      {example && <span className="example-label">Beispiel</span>}
    </div>
  );
}

function CrosswordQuestion({ block, answers = {}, setAnswer = () => { } }) {
  const entries = block.entries || [];
  const cells = useMemo(() => {
    const next = new Map();
    entries.forEach((entry) => {
      for (let index = 0; index < entry.length; index += 1) {
        const row = entry.row + (entry.direction === 'down' ? index : 0);
        const column = entry.column + (entry.direction === 'across' ? index : 0);
        const key = `${row}-${column}`;
        const cell = next.get(key) || { row, column, entries: [], number: null };
        cell.entries.push({ entry, index });
        if (index === 0) cell.number = entry.q;
        next.set(key, cell);
      }
    });
    return next;
  }, [entries]);

  const cellValue = (cell) => {
    for (const { entry, index } of cell.entries) {
      const value = String(answers[entry.q] || '')[index];
      if (value && value !== ' ') return value.toUpperCase();
    }
    return '';
  };

  const updateCell = (cell, value) => {
    const letter = Array.from(value).slice(-1)[0]?.toUpperCase() || '';
    cell.entries.forEach(({ entry, index }) => {
      const characters = Array.from({ length: entry.length }, (_, position) => String(answers[entry.q] || '')[position] || ' ');
      characters[index] = letter;
      setAnswer(entry.q, characters.join(''));
    });
  };

  const completed = entries.filter((entry) => String(answers[entry.q] || '').replace(/\s/g, '').length === entry.length).length;

  return (
    <div className="question-card crossword-question-card">
      <div className="crossword-header">
        <p><strong>{block.prompt}</strong></p>
        <span className="word-search-counter">{completed} / {entries.length} Wörter</span>
      </div>
      <div className="crossword-grid-wrap">
        <div
          className="crossword-grid"
          style={{ gridTemplateColumns: `repeat(${block.columns}, minmax(0, 1fr))` }}
          aria-label="Interaktives Kreuzworträtsel"
        >
          {Array.from({ length: block.rows * block.columns }).map((_, position) => {
            const row = Math.floor(position / block.columns);
            const column = position % block.columns;
            const cell = cells.get(`${row}-${column}`);
            if (!cell) return <div className="crossword-empty-cell" key={`${row}-${column}`} aria-hidden="true" />;
            return (
              <label className="crossword-cell" key={`${row}-${column}`}>
                {cell.number && <span className="crossword-number">{cell.number}</span>}
                <input
                  type="text"
                  inputMode="text"
                  maxLength="1"
                  value={cellValue(cell)}
                  onChange={(event) => updateCell(cell, event.target.value)}
                  aria-label={`Kreuzworträtsel Feld ${row + 1}, ${column + 1}`}
                  autoComplete="off"
                />
              </label>
            );
          })}
        </div>
      </div>
      <ol className="crossword-clues">
        {entries.map((entry) => (
          <li key={entry.q} id={`q-${entry.q}`}><strong>{entry.q}.</strong> {entry.clue}</li>
        ))}
      </ol>
    </div>
  );
}

function WordSearchQuestion({ block, answers = {}, setAnswer = () => { }, example = false }) {
  const currentAnswers = useMemo(() => {
    const raw = example ? block.acceptedAnswers : (answers[block.q] || []);
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') return Object.values(raw);
    if (typeof raw === 'string') return raw.split(/[,;\n]+/);
    return [];
  }, [answers, block.q, block.acceptedAnswers, example]);

  const slotsCount = block.answerSlots || 12;

  const handleSlotChange = (index, value) => {
    const next = [...currentAnswers];
    while (next.length < slotsCount) next.push('');
    next[index] = value;
    setAnswer(block.q, next);
  };

  const filledCount = currentAnswers.filter((w) => String(w).trim().length > 0).length;

  return (
    <div className={`question-card word-search-question-card ${example ? 'example-card' : ''}`} id={example ? undefined : `q-${block.q}`}>
      <div className="word-search-header">
        <p><strong>{example ? 'Beispiel 0' : `${block.q}.`}</strong> {block.prompt}</p>
        <span className="word-search-counter">{filledCount} / {slotsCount} Wörter</span>
      </div>

      {block.gridRows && block.gridRows.length > 0 && (
        <div className="word-search-grid-container">
          <div className="word-search-grid-title">Buchstabengitter</div>
          <div className="word-search-grid" style={{ gridTemplateColumns: `repeat(${block.gridRows[0].length}, minmax(0, 1fr))` }}>
            {block.gridRows.map((rowStr, rIdx) =>
              rowStr.split('').map((char, cIdx) => (
                <div key={`${rIdx}-${cIdx}`} className="word-search-cell">
                  {char}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="word-search-slots-section">
        <label className="word-search-slots-label">Tragen Sie hier die gefundenen Wörter ein:</label>
        <div className="word-search-slots-grid">
          {Array.from({ length: slotsCount }).map((_, index) => (
            <div key={index} className="word-search-slot-field">
              <span className="slot-number">{index + 1}.</span>
              <input
                type="text"
                className="word-search-slot-input"
                value={currentAnswers[index] || ''}
                onChange={(event) => handleSlotChange(index, event.target.value)}
                placeholder={`Wort ${index + 1}`}
                autoComplete="off"
                disabled={example}
              />
            </div>
          ))}
        </div>
      </div>
      {example && <span className="example-label">Beispiel</span>}
    </div>
  );
}

function QuestionPalette({ numbers, answers }) {
  return (
    <div className="palette">
      {numbers.map((num) => {
        const val = answers[num];
        const hasAnswer = Array.isArray(val)
          ? val.some((w) => String(w).trim().length > 0)
          : typeof val === 'object' && val !== null
            ? Object.values(val).some((w) => String(w).trim().length > 0)
            : Boolean(val);
        return (
          <button key={num} type="button" className={hasAnswer ? 'answered' : ''} onClick={() => document.getElementById(`q-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <span>{num}</span>
          </button>
        );
      })}
    </div>
  );
}

function WritingExam({ test, testBundle, profile, onBack, onComplete }) {
  const storageKey = writingStorageKey(test);
  const [responses, setResponses] = useState(() => getSavedJson(storageKey, { part1: {}, part2: '' }));
  const submitExam = () => {
    if (!window.confirm('Submit this module? You will not be able to change your answers afterwards.')) return;
    onComplete('submitted');
  };
  const handleTimeExpired = () => {
    alert('Time is over. This module has been submitted and locked.');
    onComplete('timeExpired');
  };
  const [timeLeft, setTimeLeft] = useCountdownTimer(test.durationMinutes, false, handleTimeExpired);

  useEffect(() => saveJson(storageKey, responses), [storageKey, responses]);
  const fullscreenExited = useFullscreenWarning();

  const updatePart1 = (q, value) => setResponses((previous) => ({ ...previous, part1: { ...(previous.part1 || {}), [q]: value } }));
  const updateLetter = (taskId, text) => {
    setResponses((previous) => {
      const letters = typeof previous.letters === 'object' && previous.letters ? { ...previous.letters } : {};
      letters[taskId] = text;
      // Retain part2 as first letter for backwards compatibility with single-letter consumers
      const firstKey = Object.keys(letters)[0];
      return {
        ...previous,
        letters,
        part2: letters[firstKey] || text
      };
    });
  };
  const reset = () => {
    if (!window.confirm('Clear all writing answers and restart this module?')) return;
    removeSavedJson(storageKey);
    setResponses({ part1: {}, part2: '', letters: {} });
    setTimeLeft(test.durationMinutes * 60);
  };

  return (
    <div className="exam-shell writing-shell german-writing-shell">
      {fullscreenExited && <FullscreenLock />}
      <header className="exam-header branded-header">
        <button className="link-button" onClick={onBack}><ArrowLeft size={18} /> Home</button>
        <div className="exam-title">
          <h1>German Assessment - Level {testBundle?.level || test.level || 'A1'}</h1>
          <span>{MODULE_META.writing?.title || 'Writing'} • {profile?.studentName || 'Student'}</span>
        </div>
        <div className="timer"><Clock size={18} /> {formatTime(timeLeft)}</div>
      </header>

      <div className="paper-intro">{String(test.intro || '').replace(/von Kapitel \d+/gi, 'des Tests').replace(/Kapitel \d+/gi, 'diesem Test')}</div>
      <main className="german-writing-grid">
        <div className="save-status"><Save size={17} /> Draft auto-saved in this browser</div>
        {(test.tasks || []).map((task, index) => {
          if (task.type === 'form' || task.rows) {
            return (
              <WritingPart1
                key={task.id || index}
                task={task}
                answers={responses.part1 || {}}
                setAnswer={updatePart1}
              />
            );
          }
          if (task.type === 'structuredWriting' || task.items) {
            return (
              <StructuredWritingPart
                key={task.id || index}
                task={task}
                answers={responses.part1 || {}}
                setAnswer={updatePart1}
              />
            );
          }
          if (task.type === 'letter' || task.type === 'email' || task.points || task.sourceEmail) {
            const taskId = task.id || `task_${index}`;
            const taskValue =
              (responses.letters && typeof responses.letters[taskId] === 'string')
                ? responses.letters[taskId]
                : (index === 0 ? (typeof responses.part2 === 'string' ? responses.part2 : (typeof responses.part1 === 'string' ? responses.part1 : '')) : '');
            return (
              <WritingPart2
                key={taskId}
                task={task}
                value={taskValue}
                setValue={(val) => updateLetter(taskId, val)}
              />
            );
          }
          return null;
        })}
      </main>

      <footer className="exam-footer writing-footer">
        <BrandMark compact />
        <div className="footer-actions">
          <button type="button" className="secondary-button" onClick={reset}>
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>
          <button type="button" className="primary-button" onClick={submitExam}>
            <Send size={17} />
            <span>Submit writing</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function WritingPart1({ task, answers, setAnswer }) {
  if (!task || !task.rows) return null;

  return (
    <section className="german-writing-task">
      <div className="writing-prompt german-writing-prompt">
        <p className="panel-kicker">{task.title}</p>
        <h2>{task.title}</h2>
        {task.instruction && <p>{task.instruction}</p>}
      </div>
      <div className="german-form-card">
        <h3>{task.formTitle}</h3>
        {task.rows.map((row, index) => (
          <div className="german-form-row" key={`${row.label}-${index}`} id={row.q ? `q-${row.q}` : undefined}>
            <span className="german-form-label">{row.label}</span>
            <div className="german-form-control">
              {row.q && row.inputType === 'choice' ? (
                <div className="payment-options">
                  {(row.options || []).map((option) => (
                    <label key={option}>
                      <input type="radio" name={`writing-q-${row.q}`} value={option} checked={answers[row.q] === option} onChange={(event) => setAnswer(row.q, event.target.value)} />
                      {option}
                    </label>
                  ))}
                </div>
              ) : row.q ? (
                <input value={answers[row.q] || ''} onChange={(event) => setAnswer(row.q, event.target.value)} autoComplete="off" placeholder={row.placeholder || 'Hier eingeben...'} />
              ) : (
                <span className={row.label === 'Unterschrift' ? 'signature-value' : ''}>{row.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StructuredWritingPart({ task, answers, setAnswer }) {
  if (!task || !Array.isArray(task.items)) return null;

  return (
    <section className="german-writing-task">
      <div className="writing-prompt german-writing-prompt">
        <p className="panel-kicker">{task.title}</p>
        <h2>{task.title}</h2>
        {task.instruction && <p>{task.instruction}</p>}
        {task.example && (
          <p className="instruction-example" style={{ marginTop: '8px', color: '#475569' }}>
            <strong>Beispiel:</strong> {task.example}
          </p>
        )}
        {task.exampleNote && (
          <p className="instruction-example-note" style={{ fontSize: '13px', color: '#64748b' }}>
            <em>{task.exampleNote}</em>
          </p>
        )}
      </div>
      <div className="german-form-card">
        {task.items.map((item) => (
          <div className="german-form-row" key={item.q} id={`q-${item.q}`}>
            <span className="german-form-label">
              {item.q}. {stripLeadingNumber(item.prompt)}
              {item.wordCues?.length > 0 && (
                <small className="interaction-note" style={{ display: 'block', fontWeight: 400 }}>
                  ({item.wordCues.join(' / ')})
                </small>
              )}
            </span>
            <div className="german-form-control">
              <input value={answers[item.q] || ''} onChange={(event) => setAnswer(item.q, event.target.value)} autoComplete="off" placeholder={item.placeholder ?? task.placeholder ?? ''} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WritingPart2({ task, value, setValue }) {
  if (!task) return null;
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <section className="german-writing-task letter-writing-task">
      <div className="writing-prompt german-writing-prompt">
        <p className="panel-kicker">{task.title}</p>
        <h2>{task.title}</h2>
        {task.instruction && <p>{task.instruction}</p>}
        {task.sourceEmail && (
          <div className="source-email-card">
            <div className="source-email-header">Von: {task.sourceEmail.from}</div>
            <div className="source-email-body">{task.sourceEmail.text}</div>
          </div>
        )}
        {task.points && Array.isArray(task.points) && (
          <ul>
            {task.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        )}
        {task.closingInstruction && <p>{task.closingInstruction}</p>}
        <small className="interaction-note">Word count: {wordCount}</small>
      </div>
      <textarea
        className="german-letter-textarea"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck="false"
        placeholder="Type your answer here..."
      />
    </section>
  );
}

export default App;
