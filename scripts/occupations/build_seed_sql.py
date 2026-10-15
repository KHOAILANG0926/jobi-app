#!/usr/bin/env python3
"""Build supabase/migrations/20261015100100_occupation_master_seed.sql from data/occupations/34-2020/*.json.

The seed is idempotent (insert ... on conflict do update) and inserts levels 1→5 in order so the
parent foreign key always resolves. Usage: python3 scripts/occupations/build_seed_sql.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data/occupations/34-2020'
OUT = ROOT / 'supabase/migrations/20261015100100_occupation_master_seed.sql'


def q(value):
    if value is None:
        return 'null'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def arr(values):
    return "array[" + ", ".join(q(v) for v in values) + "]::text[]" if values else "'{}'::text[]"


def text_or_null(parts):
    joined = "\n".join(p for p in parts if p).strip()
    return joined or None


def main():
    codes = json.loads((DATA / 'occupation_codes.json').read_text(encoding='utf-8'))
    descriptions = json.loads((DATA / 'descriptions.json').read_text(encoding='utf-8'))
    names = {c['code']: c['name_vi'] for c in codes}
    lines = [
        '-- 2026-10-15 [2026-10-15 사용자 승인 — 병합 시 occupation-master-apply.yml 로 적용] 공식 직업분류 34/2020 데이터 입력. 자동 생성 파일 — 직접 수정 금지.',
        '-- 생성: python3 scripts/occupations/build_seed_sql.py  (원본: data/occupations/34-2020/*.json)',
        f'-- 건수: occupation_master {len(codes)}, occupation_descriptions {len(descriptions)}',
        'begin;',
    ]
    for item in sorted(codes, key=lambda c: (c['level'], c['code'])):
        lines.append(
            'insert into public.occupation_master (code, level, parent_code, name_vi, source_file, source_row) values ('
            f"{q(item['code'])}, {item['level']}, {q(item['parent_code'])}, {q(item['name_vi'])}, "
            f"{q(item['source_file'])}, {item['source_row']}) on conflict (code) do update set level = excluded.level, "
            'parent_code = excluded.parent_code, name_vi = excluded.name_vi, source_file = excluded.source_file, '
            'source_row = excluded.source_row;')
    aliases = []
    for d in descriptions:
        lines.append(
            'insert into public.occupation_descriptions (code, description, main_tasks, examples, exclusions, skill_note, '
            'source_file, source_paragraph) values ('
            f"{q(d['code'])}, {q(text_or_null(d['description']))}, {arr(d['main_tasks'])}, {arr(d['examples'])}, "
            f"{arr(d['exclusions'])}, {q(text_or_null(d['skill_note']))}, {q(d['source_file'])}, {d['source_paragraph']}) "
            'on conflict (code) do update set description = excluded.description, main_tasks = excluded.main_tasks, '
            'examples = excluded.examples, exclusions = excluded.exclusions, skill_note = excluded.skill_note, '
            'source_file = excluded.source_file, source_paragraph = excluded.source_paragraph;')
        alias = d.get('alias_vi')
        if alias and alias.casefold() != names[d['code']].casefold():
            aliases.append((d['code'], alias))
    for code, alias in sorted(set(aliases)):
        lines.append('insert into public.occupation_aliases (code, alias_vi, source) values ('
                     f"{q(code)}, {q(alias)}, 'appendix_ii_title') on conflict (code, alias_vi) do nothing;")
    lines += [f'-- aliases: {len(set(aliases))}', 'commit;', '']
    OUT.write_text("\n".join(lines), encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)}: master={len(codes)} descriptions={len(descriptions)} aliases={len(set(aliases))}')


if __name__ == '__main__':
    main()
