# German CBT Platform – Comprehensive System & Developer Guide

> **Note**: This documentation is kept strictly local and is explicitly ignored in `.gitignore` so that it will never be added to git or pushed to GitHub.

---

## 1. Project Overview & Architecture

### What is this project?
The **German CBT Platform (Computer-Based Testing)** is a web-based examination and practice testing system for German language learners (A1 & A2 levels). It simulates official Goethe-Institut examinations and modular classroom assessments.

### Key Capabilities
- **Timed examinations** with full-screen focus enforcement.
- **Audio playback** with realistic exam restrictions (e.g. 1 or 2 plays per task or continuous track).
- **Interactive Question Formats**:
  - Multiple Choice (`choice`, `imageChoice`, `sourceChoice`, `noticeChoice`)
  - Fill-in-the-blank & Short Answer (`textInput`, `multiTextInput`)
  - Dialogue Sequence Ordering (`conversationOrdering`)
  - Word Bank drag-and-drop (`dialogueWordBank`)
  - Sentence Gap Fills (`sentenceGaps`)
  - Drag-and-drop / Image Matching (`matching`, `imageOrderingDrop`, `imageGridInputs`)
  - Interactive Crosswords & Word Searches (`crossword`, `wordSearch`)
- **Writing Module**:
  - Part 1: Registration Form completion (`form` with auto-graded or manual review inputs)
  - Part 2: Email / Letter composition with auto-save in localStorage
- **Real-Time Grading & Evaluation**:
  - Automatic answer normalization (handles German umlauts `ä, ö, ü, ß`, capitalization, and common variants).
  - Detailed score reports with download option (PDF / Text).

---

## 2. Technology Stack

- **Frontend Framework**: [React 18](https://react.dev/)
- **Bundler & Dev Server**: [Vite 5](https://vitejs.dev/)
- **Icons**: [lucide-react](https://lucide.dev/)
- **Styling**: Vanilla CSS (`src/styles.css`) for high performance and custom design.
- **Data Architecture**: Pure static JSON bundles stored under the `tests/` directory and loaded dynamically using Vite's `import.meta.glob`.

---

## 3. Directory Structure

```
german-code-/
├── package.json               # Dependencies and scripts (dev, build, validate-test, test)
├── vite.config.js             # Vite configuration with React plugin
├── index.html                 # Entry HTML file
├── src/
│   ├── main.jsx               # React DOM entry point
│   ├── App.jsx                # Main application UI, routing, and all question block renderers
│   ├── styles.css             # Unified CSS styles for portal, exam screens, and cards
│   ├── services/
│   │   └── loadTest.js        # Dynamic test loader resolving JSON & media assets
│   ├── hooks/
│   │   └── useCountdownTimer.js # Timer hook managing module time limits
│   └── utils/
│       ├── constants.js       # Global constants (e.g., NO_INFORMATION_VALUE)
│       ├── report.js          # Answer normalization, auto-grading, and scoring logic
│       ├── storage.js         # LocalStorage helpers for drafts and state persistence
│       └── time.js            # Time formatting helpers
├── tests/
│   ├── index.json             # Manifest of all available tests shown on the portal
│   ├── A1 Full Test 1/        # Goethe A1 practice papers
│   ├── Unit 1/ ... Unit 12/   # Modular Unit tests (Listening, Reading, Writing, Grammar)
│   ├── Regular 1/ ... /       # Extended practice tests
│   └── Fastrack 1/ ... /      # Fastrack intensive tests
└── scripts/
    ├── package-checks.mjs     # Core validator verifying JSON structure, UTF-8, and answer keys
    ├── validate-test.mjs      # CLI runner for package-checks (npm run validate-test)
    └── grading.test.mjs       # Unit tests verifying grading accuracy
```

---

## 4. Test Folder Anatomy: What makes up a Test?

Every subfolder inside `tests/` (e.g., `tests/Unit 1/`) represents an independent examination package.

### 4.1. `config.json` (Required)
Defines metadata, allowed duration, and active modules:
```json
{
  "schemaVersion": 1,
  "id": "unit-1",
  "name": "Unit 1",
  "level": "A1",
  "sections": ["listening", "reading", "writing", "grammar"],
  "durations": {
    "listening": 15,
    "reading": 25,
    "writing": 15,
    "grammar": 15
  },
  "audio": null
}
```

### 4.2. Objective Modules (`listening/`, `reading/`, `grammar/`)
Each module folder contains:
1. **`questions.json`**:
   - `schemaVersion`: Must be `1`.
   - `sections`: An array of section objects.
   - Each section has:
     - `title`: e.g., `"Lesen – Teil 1"`
     - `passageTitle`: Header for the reading document
     - `passage`: Text for the passage (supports `\n\n` for paragraphs)
     - `guidance` *(optional)*: Banner object with rules & examples above the question cards
     - `blocks`: Array of question items
2. **`answers.json`**:
   - Contains an `"answers"` dictionary mapping question number strings (`"1"`, `"2"`, etc.) to accepted answer arrays:
     ```json
     {
       "schemaVersion": 1,
       "answers": {
         "1": ["b"],
         "2": ["Österreich", "oesterreich"]
       }
     }
     ```

### 4.3. Writing Module (`writing/`)
Contains:
1. **`tasks.json`**:
   - Defines tasks (`form` for registration form with `rows`, or `letter` / `email` with `points`).
2. **`answers.json`**:
   - Accepted answer keys for form fields with question numbers (`row.q`).

---

## 5. Supported Question Block Types in `questions.json`

When authoring question blocks, use any of these supported types:

| Block Type | Description | Key Properties |
| :--- | :--- | :--- |
| `choice` | Standard multiple choice | `q`, `prompt`, `options: { "a": "Text", "b": "Text" }` |
| `imageChoice` | Choice with images A, B, C | `q`, `prompt`, `options: { "a": "assets/...", "b": "..." }` |
| `sourceChoice` | Choose which source matches | `q`, `prompt`, `sources: { "1": "Source A", "2": "Source B" }` |
| `noticeChoice` | True/False statement | `q`, `prompt`, `options: { "richtig": "Richtig", "falsch": "Falsch" }` |
| `textInput` | Fill in the blank / Short text | `q`, `prompt`, `placeholder`, `inputMode: "shortAnswer"` |
| `multiTextInput`| Multiple blanks in one card | `q`, `prompt`, `fields: [{ "id": 1, "placeholder": "..." }]` |
| `conversationOrdering`| Ordering dialogue lines | `columns`, `items: [{ "id": "1", "q": 1, "text": "..." }]` |
| `sentenceGaps` | Gap fills within sentences | `cardTitle`, `sentences: [{ "segments": [...] }]` |
| `matching` | Drag & drop matching pairs | `leftItems`, `rightItems` |
| `crossword` | Interactive crossword puzzle | `grid`, `entries` |
| `wordSearch` | Word search puzzle grid | `grid`, `wordList` |
| `sectionLabel` | Subheading divider between groups | `text` |

### How to Add Examples Above Input Questions
There are two ways to display an example for students before they type:
1. **Section Guidance Banner** (Recommended):
   Add a `guidance` object to the section:
   ```json
   "guidance": {
     "badge": "Lückentext / Fill in the blank",
     "text": "Tragen Sie nur das fehlende Wort in das Feld ein.",
     "rule": "Geben Sie nur die gesuchte Lücke ein",
     "example": "„Maria kommt aus _____ .“ -> Eingabe: Österreich",
     "exampleNote": "Achten Sie auf Groß- und Kleinschreibung bei Nomen."
   }
   ```
2. **Example Card (`exampleTextInput`)**:
   Add a card above the question without a `q` property:
   ```json
   {
     "type": "exampleTextInput",
     "prompt": "Beispiel: Maria lernt am Abend ______.",
     "answer": "Deutsch",
     "placeholder": "Deutsch"
   }
   ```

---

## 6. Step-by-Step Guide: How to Add a New Test

Follow these exact steps whenever you want to add a new test paper:

### Step 1: Create the Folder
Under `tests/`, create a new folder with a descriptive name, e.g.:
```
tests/Unit 13/
```

### Step 2: Create `config.json`
Inside `tests/Unit 13/config.json`:
```json
{
  "schemaVersion": 1,
  "id": "unit-13",
  "name": "Unit 13",
  "level": "A1",
  "sections": ["listening", "reading", "writing", "grammar"],
  "durations": {
    "listening": 15,
    "reading": 25,
    "writing": 15,
    "grammar": 15
  },
  "audio": null
}
```

### Step 3: Create Module Folders and Questions
Add the subdirectories for the declared sections:
- `listening/`
  - `questions.json`
  - `answers.json`
  - Optional audio files: `listening/q1_audio.mp3`, etc.
- `reading/`
  - `questions.json`
  - `answers.json`
- `writing/`
  - `tasks.json`
  - `answers.json`
- `grammar/`
  - `questions.json`
  - `answers.json`

### Step 4: Register the Test in `tests/index.json`
Open [`tests/index.json`](file:///c:/Users/vaibhavi/Favorites/Downloads/BFF-Work/german-code-/tests/index.json) and add an entry so it appears on the selection screen:
```json
{
  "id": "Unit 13",
  "name": "Unit 13",
  "level": "A1",
  "description": "Assessment covering Unit 13 curriculum."
}
```

### Step 5: Validate the New Test
Open a terminal and run the test validator:
```bash
npm run validate-test
```
The validator checks:
- Clean UTF-8 encoding (catches corrupted umlauts).
- Matching question IDs between `questions.json` and `answers.json`.
- Valid option keys in multiple-choice questions.

### Step 6: Test in the Browser
Start the development server if not already running:
```bash
npm run dev
```
Navigate to `http://localhost:5173`, find your new test in the repository list, and verify that all questions and audio render as expected.

---

## 7. Important Development Rules & Best Practices

1. **Never commit sensitive or local-only docs to GitHub**:
   - Keep `.gitignore` updated. Files like `PROJECT_DOCUMENTATION.md` are ignored to prevent accidental leaks.
2. **Always use UTF-8 without BOM**:
   - Ensure text files (especially German text with `ä, ö, ü, ß`) are saved in UTF-8 format.
3. **Never duplicate question numbers (`q`) within a module**:
   - Each question number in `questions.json` must be unique so that answers and scoring correlate 1:1 with `answers.json`.
4. **Example blocks must NOT have a `q` property**:
   - Example cards like `exampleTextInput` or `exampleChoice` should never have `"q": <number>`, as this would confuse the grader.
