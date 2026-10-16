import json
import sys

def inspect_test(u):
    print(f"================ {u} DETAILS ================")
    for mod in ['reading', 'listening']:
        with open(f"tests/{u}/{mod}/questions.json", encoding="utf-8") as f:
            q_data = json.load(f)
        with open(f"tests/{u}/{mod}/answers.json", encoding="utf-8") as f:
            a_data = json.load(f)
        answers = a_data.get("answers", a_data)
        print(f"\n--- {mod.upper()} (Sections: {len(q_data['sections'])}) ---")
        for s_idx, s in enumerate(q_data['sections']):
            print(f"Section {s_idx+1}: {s.get('title')}")
            for b in s['blocks']:
                b_type = b.get('type')
                if 'q' in b:
                    print(f"  Q{b['q']} [{b_type}]: {b.get('prompt', '')[:50]} -> Ans: {answers.get(str(b['q']))}")
                elif 'items' in b:
                    print(f"  Block [{b_type}] with {len(b['items'])} items:")
                    for item in b['items']:
                        if item.get('example'):
                            print(f"    [Beispiel]: {item.get('text')} (Pos {item.get('position')})")
                        else:
                            print(f"    Q{item.get('q')}: {item.get('text')} -> Ans: {answers.get(str(item.get('q')))}")
                elif 'lines' in b:
                    print(f"  Block [{b_type}] with {len(b['lines'])} lines:")
                    for line in b['lines']:
                        if 'q' in line:
                            b_text = line.get('before', '')
                            a_text = line.get('after', '')
                            print(f"    Q{line.get('q')}: {line.get('speaker')}: \"{b_text}[___]{a_text}\" -> Ans: {answers.get(str(line.get('q')))}")

if __name__ == '__main__':
    inspect_test('Unit 1')
    print("\n")
    inspect_test('Unit 2')
