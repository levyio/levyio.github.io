"""Offline regression checks for the public one-link AI research gateway.

These tests validate transport and disclosure contracts, not scientific truth,
GitHub Pages deployment, real GitHub authentication or model capabilities.
"""
import json
import re
import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
PAGES_SITE = "https://levyio.github.io/pharma-stability-ai/"
PUBLIC_ISSUES = "https://github.com/levyio/levyio.github.io/issues"


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs).get("href", ""))


class GatewayContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "protocol.json").read_text(encoding="utf-8"))
        cls.instructions = (ROOT / "AGENT_START.md").read_text(encoding="utf-8")
        cls.tasks = (ROOT / "PUBLIC_TASKS.md").read_text(encoding="utf-8")
        cls.spec = (ROOT / "OPEN_CONTRIBUTION_PROTOCOL.md").read_text(encoding="utf-8")
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")

    def test_manifest_declares_public_access_and_private_boundary(self):
        data = self.manifest
        self.assertEqual(data["protocol"], "open-contribution-handshake")
        self.assertEqual(data["entry_url"], PAGES_SITE)
        self.assertEqual(data["public_repository"], "levyio/levyio.github.io")
        self.assertTrue(data["permissions"]["public_read"])
        self.assertFalse(data["permissions"]["private_core_access_required"])
        self.assertTrue(data["permissions"]["public_issue_create_requires_github_identity"])
        self.assertTrue(data["permissions"]["ai_tool_write_requires_explicit_authorization"])
        self.assertFalse(data["permissions"]["dormant_chat_automatic_wakeup"])

    def test_minimum_machine_and_human_entry_files_exist(self):
        for name in ["AGENT_START.md","PUBLIC_TASKS.md","protocol.json",
                     "OPEN_CONTRIBUTION_PROTOCOL.md","index.html"]:
            with self.subTest(name=name):
                self.assertGreater((ROOT / name).stat().st_size, 100)

    def test_submission_route_references_actual_issue_form(self):
        form = ROOT.parents[0] / ".github" / "ISSUE_TEMPLATE" / "pharma-contribution.yml"
        self.assertTrue(form.exists(), f"Missing issue form: {form}")
        body = form.read_text(encoding="utf-8")
        self.assertIn('title: "[PSAI] "', body)
        self.assertIn("Primary sources", body)
        self.assertIn("Public submission safeguards", body)
        self.assertEqual(self.manifest["public_issue_tracker"], PUBLIC_ISSUES)
        self.assertIn("template=pharma-contribution.yml", self.manifest["public_issue_form_url"])

    def test_public_url_and_roles_exposed_in_page(self):
        parser = Links()
        parser.feed(self.html)
        for local in ["./AGENT_START.md", "./PUBLIC_TASKS.md"]:
            self.assertIn(local, parser.links)
        for role in ["evidence-scout", "scientific-challenger", "developer"]:
            self.assertIn(role, self.manifest["roles"])
        self.assertIn(PAGES_SITE, self.html)
        self.assertIn("Copy AI instructions", self.html)

    def test_no_false_guarantee_of_direct_posting(self):
        text = self.instructions.lower()
        for expected in ["not submitted", "if you cannot open the url",
                         "the participant", "write permission", "real issue url"]:
            self.assertIn(expected, text)
        self.assertTrue(self.manifest["publishing"]["verify_receipt_required"])
        self.assertEqual(self.manifest["publishing"]["fallback_not_posted_label"], "NOT SUBMITTED")

    def test_privacy_and_medical_warnings(self):
        sources = [self.instructions, self.tasks, self.spec, self.html]
        for text in sources:
            with self.subTest(head=text[:50]):
                self.assertRegex(text.lower(), "private")
                self.assertRegex(text.lower(), "expired")
        self.assertTrue(self.manifest["source_rules"]["no_private_or_patient_data_in_public_issues"])
        self.assertTrue(self.manifest["source_rules"]["no_expired_medicine_safety_claims"])

    def test_public_session_roles_independent_of_ai_plan(self):
        self.assertIn("GitHub", self.instructions)
        self.assertIn("AI", self.instructions)
        self.assertIn("CONSENT", self.spec)
        self.assertIn("RECEIPT", self.spec)
        self.assertIn("REVIEW", self.spec)
        self.assertGreater(len(self.manifest["lifecycle"]), 5)


if __name__ == "__main__":
    unittest.main()
