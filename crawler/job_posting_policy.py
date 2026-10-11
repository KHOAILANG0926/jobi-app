"""Pure evaluator sharing rule data with src/lib/jobPostingPolicy.mjs."""
import json
import re
import unicodedata
from pathlib import Path

RULES = json.loads((Path(__file__).resolve().parents[1] / "policy/job-posting-rules.json").read_text("utf-8"))
POLICY_VERSION = RULES["version"]


def normalize_policy_text(value):
    text = unicodedata.normalize("NFD", str(value or "").lower()).replace("đ", "d")
    text = "".join(c for c in text if not unicodedata.category(c).startswith("M"))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _matches(name, text):
    return any(re.search(pattern, text) for pattern in RULES[name])


def _money_reason(fields):
    for text in (fields["title"], fields["category"]):
        if _matches("debt_role", text):
            return "dedicated_debt_collection"
        for root, targets, window in RULES["debt"]:
            for target in targets:
                a, b = r"\b" + re.escape(root) + r"\b", r"\b" + re.escape(target) + r"\b"
                if re.search(a + ".{0," + str(window) + "}" + b + "|" + b + ".{0," + str(window) + "}" + a, text):
                    return "dedicated_debt_collection"
    if _matches("loan_role", fields["title"]):
        return "dedicated_finance_sales"
    if _matches("sales_role", fields["title"]) and (
        _matches("loan_product", fields["title"] + " " + fields["description"])
        or _matches("finance_company", fields["company"])
    ):
        return "dedicated_finance_sales"
    return None


def evaluate_job_posting_policy(job):
    fields = {key: normalize_policy_text(re.sub(r"\[source:[^\]]*\]", "", str(job.get(key) or ""), flags=re.I) if key == "description" else job.get(key)) for key in
              ("title", "company", "description", "category", "salary")}
    def result(decision, reason):
        return {"decision": decision, "reason": reason, "version": POLICY_VERSION}
    money = _money_reason(fields)
    if money:
        return result("exclude", money)
    if not fields["title"] or not fields["description"] or _matches("ambiguous_title", fields["title"]):
        return result("review", "incomplete_role_evidence")
    text = fields["title"] + " " + fields["description"]
    sales = _matches("sales_role", fields["title"])
    retail = _matches("retail_primary", text)
    b2b = _matches("b2b_primary", text)
    if sales and b2b:
        return result("review", "mixed_retail_b2b") if retail else result("exclude", "primary_b2b_field_dealer_sales")
    if sales and _matches("b2b_signal", text):
        return result("review", "unclear_b2b_role")
    pay = fields["description"] + " " + fields["salary"]
    if sales and not retail and _matches("professional_sales", fields["title"]) and _matches("incentive", pay) and _matches("high_income", pay):
        return result("review", "professional_incentive_sales")
    if sales and not retail:
        return result("review", "unclear_sales_role")
    return result("allow", "no_excluded_role_evidence")


def has_excluded_money_role(job):
    return evaluate_job_posting_policy(job)["reason"] in (
        "dedicated_finance_sales", "dedicated_debt_collection")


def crawler_policy_errors(job):
    result = evaluate_job_posting_policy(job)
    if result["decision"] == "allow":
        return []
    return ["posting policy skip: " + result["decision"] + "/" + result["reason"]]
