"""Run actual writer functions in isolation, without importing credential/network setup."""
import ast
import unittest
from pathlib import Path
from job_posting_policy import evaluate_job_policy, require_allowed

ROOT = Path(__file__).resolve().parents[1]

def load_function(path, name, namespace):
    tree = ast.parse((ROOT / path).read_text('utf-8'))
    function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[function], type_ignores=[]), path, 'exec'), namespace)
    return namespace[name]

class WriteGates(unittest.TestCase):
    def test_crawler_new_and_reentry_skip_before_lookup_or_write(self):
        def unexpected(*args, **kwargs):
            self.fail('blocked job reached DB lookup/write')
        fn = load_function('crawler/crawl_topcv.py', 'upsert_job_record', {
            '_require_write_enabled': lambda: None,
            'evaluate_job_policy': evaluate_job_policy, 'match_existing_row': unexpected,
        })
        for job in ({'title':'Sales B2B','description':'Tìm khách hàng doanh nghiệp'},
                    {'title':'Sales','description':'Chưa rõ nhiệm vụ'}, {}):
            for existing in ({}, {'source': {'id': 1}}):
                self.assertEqual(fn(job, existing, {})['action'], 'policy_skipped')

    def test_chotot_blocked_before_http(self):
        fn = load_function('scripts/research/bn_apply_chotot_rest.py', 'post', {'require_allowed':require_allowed})
        with self.assertRaisesRegex(ValueError, 'job_policy'):
            fn('local_jobs', {'title':'Tư vấn tín dụng','description':'Cho vay'})

    def test_facebook_filters_before_dedup_and_insert(self):
        seen = []
        class StopAfterGate(Exception): pass
        def after_gate(jobs, rows):
            seen.extend(jobs)
            raise StopAfterGate()
        fn = load_function('crawler/crawl_facebook.py', 'save_to_supabase', {
            'supabase': True, 'missing_required':lambda job: [],
            'evaluate_job_policy':evaluate_job_policy, 'fetch_existing_facebook_rows':lambda: [],
            'filter_new_jobs':after_gate, 'print':lambda *args: None,
        })
        allowed = {'title':'QC','description':'Kiểm tra chất lượng'}
        with self.assertRaises(StopAfterGate):
            fn([{'title':'Sales B2B','description':'B2B'}, {'title':'Sales'}, allowed])
        self.assertEqual(seen, [allowed])

if __name__ == '__main__': unittest.main()
