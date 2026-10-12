"""Offline application gate; shared declarative rules, no network or credentials."""
import json
import re
import unicodedata
from pathlib import Path

SPEC = json.loads((Path(__file__).resolve().parents[1] / 'policy/job-posting-v1.json').read_text('utf-8'))

def normalize(value):
    if not isinstance(value, str):
        return ''
    value = unicodedata.normalize('NFD', value.lower()).replace('đ', 'd')
    value = re.sub('[\u0300-\u036f]', '', value)
    value = unicodedata.normalize('NFC', value)
    return re.sub(r' +', ' ', re.sub(r'[^a-z0-9가-힣]', ' ', value)).strip()

def matches(pattern, text):
    return bool(re.search(r'(^|[^a-z0-9])(?:' + pattern + r')(?=$|[^a-z0-9])', text))

def evaluate_job_policy(job):
    def result(decision, reason):
        return {'decision': decision, 'reason': reason, 'version': SPEC['version']}
    try:
        if not isinstance(job, dict):
            return result('review', 'missing_content')
        fields = {k: normalize(job.get(k)) for k in ('title', 'description', 'category')}
        role = fields['title'] + ' ' + fields['description']
        local_work = matches(SPEC['local_work'], fields['title']) or matches(SPEC['local_duty'], fields['description'])
        established_sales = local_work or matches(SPEC['office_sales'], fields['description'])
        review = None
        for rule in SPEC['rules']:
            if rule.get('unless') == 'office_sales' and matches(SPEC['office_sales'], fields['description']):
                continue
            if rule.get('unless') == 'local_work' and local_work:
                continue
            if rule.get('unless') == 'established_sales' and established_sales:
                continue
            if rule.get('requires') and not matches(SPEC[rule['requires']], role):
                continue
            for field in rule['fields']:
                if not matches(rule['pattern'], fields[field]):
                    continue
                if matches(SPEC['negation'], fields[field]):
                    review = 'ambiguous_role'
                    continue
                if rule['decision'] == 'exclude':
                    return result('exclude', rule['id'])
                review = review or rule['id']
        if not fields['title'] or not fields['description']:
            return result('review', 'missing_content')
        if review:
            return result('review', review)
        if matches(SPEC['generic_title'], fields['title']) and not matches(SPEC['substantive_duty'], fields['description']):
            return result('review', 'ambiguous_role')
        if matches(SPEC['sales'], role) and not established_sales:
            return result('review', 'unclear_sales')
        return result('allow', 'allowed')
    except Exception:
        return result('review', 'policy_unavailable')

def require_allowed(job):
    decision = evaluate_job_policy(job)
    if decision['decision'] != 'allow':
        raise ValueError('job_policy:' + decision['reason'])
    return decision
