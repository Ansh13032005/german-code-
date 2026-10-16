# Scripts Guide for German CBT Unit Tests

This folder contains scripts to automate inspecting source files and validating generated JSON test packages.

---

## 1. Inspection Script (Before Work)

### `inspect_unit.py`
Inspects any `Unit wise test/Unit wise test/Unit X` folder:
- Lists all audio files (`.mp3`) with exact byte counts.
- Detects all Word documents (`.docx`).
- Unpacks and displays embedded media files (images/drawings in `word/media/`), so no images are ever missed.
- Previews document text paragraphs and questions.

### Usage:
```bash
# By unit number:
python scripts/inspect_unit.py 2

# Or by folder path:
python scripts/inspect_unit.py "Unit wise test/Unit wise test/Unit 2"
```

---

## 2. Validation Script (After Work)

### `validate_unit_test.py`
Performs a comprehensive sanity and integrity check on a converted test folder (e.g. `tests/Unit 1`):
1. **JSON Syntax**: Validates all JSON files (`config.json`, `manifest.json`, `questions.json`, `answers.json`, `tasks.json`).
2. **Registration Check**: Verifies that the unit is registered in `tests/index.json`.
3. **Asset Verification**: Checks that every audio path (`.mp3`) and image path (`.png`/`.jpg`) referenced in `questions.json` actually exists on disk.
4. **Answer Key Check**: Verifies that answer keys have correct question counts.

### Usage:
```bash
# Validate a specific unit test:
python scripts/validate_unit_test.py "Unit 1"
python scripts/validate_unit_test.py "Unit 2"

# Validate all registered Unit tests at once:
python scripts/validate_unit_test.py all
```
