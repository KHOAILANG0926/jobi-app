import json
import unittest
from pathlib import Path
from job_posting_policy import evaluate_job_policy, require_allowed

class PolicyTests(unittest.TestCase):
    def test_shared_cases(self):
        cases = json.loads((Path(__file__).resolve().parents[1] / 'policy/cases.json').read_text('utf-8'))
        for case in cases:
            with self.subTest(case=case['name']):
                self.assertEqual(evaluate_job_policy(case['job'])['decision'], case['decision'])
                if case['decision'] != 'allow':
                    with self.assertRaises(ValueError):
                        require_allowed(case['job'])

    def test_invalid_input(self):
        self.assertEqual(evaluate_job_policy(None)['decision'], 'review')

if __name__ == '__main__':
    unittest.main()
