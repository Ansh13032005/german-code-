#!/usr/bin/env python3
"""
Validate Unit Test Directory
Verifies that a converted test directory (e.g. tests/Unit 1, tests/Unit 2)
contains all valid JSONs, valid audio files, and valid image references.

Usage:
    python scripts/validate_unit_test.py "Unit 1"
    python scripts/validate_unit_test.py all
"""

import sys
import os
import json

def check_json(file_path):
    if not os.path.exists(file_path):
        return False, f"Missing file: {file_path}", None
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        return True, "Valid JSON", data
    except Exception as e:
        return False, f"JSON Error in {file_path}: {e}", None

def collect_images_and_audio(data, base_dir):
    missing_assets = []
    found_assets = []

    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in ['image', 'audio'] and isinstance(v, str):
                    asset_path = os.path.join(base_dir, v)
                    if not os.path.exists(asset_path):
                        missing_assets.append(f"{k} reference not found on disk: {v} -> {asset_path}")
                    else:
                        found_assets.append((k, v))
                else:
                    walk(v)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(data)
    return missing_assets, found_assets

def validate_test_unit(unit_id):
    test_dir = os.path.join("tests", unit_id)
    if not os.path.exists(test_dir):
        print(f"[FAIL] Test directory does not exist: {test_dir}")
        return False

    print("=" * 60)
    print(f"VALIDATING TEST: {unit_id} (Path: {test_dir})")
    print("=" * 60)

    errors = []
    warnings = []

    # Check config.json
    ok, msg, config = check_json(os.path.join(test_dir, "config.json"))
    if not ok:
        errors.append(msg)
    else:
        print(f"[OK] config.json (Sections: {config.get('sections')})")

    # Check manifest.json
    ok, msg, manifest = check_json(os.path.join(test_dir, "manifest.json"))
    if not ok:
        errors.append(msg)
    else:
        print(f"[OK] manifest.json")

    # Check registered in tests/index.json
    ok, msg, index_data = check_json("tests/index.json")
    if ok:
        registered = any(item.get("id") == unit_id for item in index_data)
        if registered:
            print(f"[OK] Registered in tests/index.json")
        else:
            errors.append(f"Unit '{unit_id}' is NOT registered in tests/index.json")

    sections = config.get("sections", []) if config else ["listening", "reading", "writing"]

    # Check Listening
    if "listening" in sections:
        q_file = os.path.join(test_dir, "listening", "questions.json")
        a_file = os.path.join(test_dir, "listening", "answers.json")
        ok, msg, q_data = check_json(q_file)
        if not ok:
            errors.append(msg)
        else:
            miss, found = collect_images_and_audio(q_data, test_dir)
            errors.extend(miss)
            print(f"[OK] listening/questions.json (Assets linked: {len(found)})")
            for k, f in found:
                print(f"     * {k}: {f}")

        ok, msg, a_data = check_json(a_file)
        if not ok:
            errors.append(msg)
        else:
            ans_count = len(a_data.get("answers", {}))
            print(f"[OK] listening/answers.json ({ans_count} question keys defined)")

    # Check Reading
    if "reading" in sections:
        q_file = os.path.join(test_dir, "reading", "questions.json")
        a_file = os.path.join(test_dir, "reading", "answers.json")
        ok, msg, q_data = check_json(q_file)
        if not ok:
            errors.append(msg)
        else:
            miss, found = collect_images_and_audio(q_data, test_dir)
            errors.extend(miss)
            print(f"[OK] reading/questions.json (Assets linked: {len(found)})")

        ok, msg, a_data = check_json(a_file)
        if not ok:
            errors.append(msg)
        else:
            ans_count = len(a_data.get("answers", {}))
            print(f"[OK] reading/answers.json ({ans_count} question keys defined)")

    # Check Writing
    if "writing" in sections:
        t_file = os.path.join(test_dir, "writing", "tasks.json")
        ok, msg, t_data = check_json(t_file)
        if not ok:
            errors.append(msg)
        else:
            task_count = len(t_data.get("tasks", []))
            print(f"[OK] writing/tasks.json ({task_count} tasks defined)")

    print("-" * 60)
    if errors:
        print(f"RESULT: [FAIL] {len(errors)} ERROR(S) FOUND:")
        for e in errors:
            print(f"  - {e}")
        return False
    else:
        print("RESULT: [PASS] ALL CHECKS PASSED PERFECTLY!")
        return True

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "Unit 1"
    if target.lower() == "all":
        with open("tests/index.json", "r", encoding="utf-8-sig") as f:
            index = json.load(f)
        units = [t["id"] for t in index if t["id"].startswith("Unit")]
        all_ok = True
        for u in units:
            res = validate_test_unit(u)
            if not res: all_ok = False
            print("\n")
        sys.exit(0 if all_ok else 1)
    else:
        success = validate_test_unit(target)
        sys.exit(0 if success else 1)
