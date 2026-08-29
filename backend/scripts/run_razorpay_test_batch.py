"""Create and monitor a real Razorpay Test Mode recovery batch.

This tool deliberately never fabricates a webhook and never sends a forged
``payment.failed`` or ``payment_link.paid`` request to Reven. Razorpay sends
the webhooks after a human selects Failure or Success on its Test Mode checkout.

Run from ``backend/`` with the Test Mode values in ``.env``:

  python scripts/run_razorpay_test_batch.py plan --batch-id buildathon-01 --count 30
  python scripts/run_razorpay_test_batch.py create-orders --batch-id buildathon-01 --count 30 --apply
  python scripts/run_razorpay_test_batch.py status --batch-id buildathon-01
  python scripts/run_razorpay_test_batch.py prepare-recoveries --batch-id buildathon-01 --limit 8 --apply
  python scripts/run_razorpay_test_batch.py report --batch-id buildathon-01

The generated HTML board contains public Test Mode key IDs and order IDs, never
API secrets. Complete failures and recovery successes manually in Razorpay's
mock checkout. This keeps every dashboard result attributable to a genuine
Razorpay Test Mode webhook.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

import httpx

from app.config import get_config


RAZORPAY_API = "https://api.razorpay.com/v1"
DEFAULT_BACKEND_URL = "https://reven-api.onrender.com"
DEFAULT_OUTPUT_DIR = Path(".reven-test-batches")
MIN_BATCH_SIZE = 30
MAX_BATCH_SIZE = 50
TRUST_GATE_RAPID_CASES = 8  # with a default cap of 5, cases 6–8 are blocked


@dataclass(frozen=True)
class CasePlan:
    index: int
    case_id: str
    scenario: str
    expected_error_reason: str
    amount: int
    contact: str
    customer_name: str
    trust_gate_fixture: bool = False


SCENARIOS: tuple[tuple[str, str, str], ...] = (
    ("soft_decline", "payment_failed", "Use Razorpay's Failure action for a temporary issuer or gateway decline."),
    ("insufficient_funds", "insufficient_funds", "Use Razorpay's documented insufficient-funds error-scenario test card, then select Failure."),
    ("otp_drop", "incorrect_otp", "On the mock bank page, enter an OTP shorter than four digits to fail authentication."),
    ("unsupported_card", "card_not_supported", "Use Razorpay's documented unsupported-card error-scenario test card, then select Failure."),
    ("generic_processor_failure", "payment_failed", "Use the mock bank page Failure action; record the actual error returned by Razorpay."),
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_batch_id(value: str) -> str:
    clean = "".join(char if char.isalnum() or char in "-_" else "-" for char in value.strip().lower())
    if not clean:
        raise ValueError("batch id must contain letters or numbers")
    return clean[:48]


def batch_paths(batch_id: str, output_dir: Path) -> tuple[Path, Path, Path]:
    root = output_dir / safe_batch_id(batch_id)
    return root / "manifest.json", root / "failure-checkout.html", root / "recovery-checkout.html"


def make_plan(batch_id: str, count: int) -> list[CasePlan]:
    if not MIN_BATCH_SIZE <= count <= MAX_BATCH_SIZE:
        raise ValueError(f"count must be between {MIN_BATCH_SIZE} and {MAX_BATCH_SIZE}")

    amount_cycle = (49, 149, 324, 499, 999, 1_500, 2_499, 7_500, 9_900)
    cases: list[CasePlan] = []
    for index in range(1, count + 1):
        trust_fixture = index <= TRUST_GATE_RAPID_CASES
        scenario_name, error_reason, _ = SCENARIOS[(index - 1) % len(SCENARIOS)]
        amount = amount_cycle[(index - 1) % len(amount_cycle)]
        if trust_fixture:
            # Same fictional Test Mode contact creates a true repeated-attempt pattern.
            contact = "9000000100"
            scenario_name = "trust_gate_rapid_repeat"
            error_reason = "payment_failed"
            amount = 49 if index % 2 else 99
        else:
            contact = f"900{index:07d}"[-10:]
        cases.append(
            CasePlan(
                index=index,
                case_id=f"reven-{safe_batch_id(batch_id)}-{index:03d}",
                scenario=scenario_name,
                expected_error_reason=error_reason,
                amount=amount,
                contact=contact,
                customer_name=f"Reven Test Batch {safe_batch_id(batch_id)} #{index:03d}",
                trust_gate_fixture=trust_fixture,
            )
        )
    return cases


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"No batch manifest at {path}. Run plan or create-orders first.")
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")


def require_test_key() -> tuple[str, str]:
    config = get_config()
    key_id = os.getenv("RAZORPAY_KEY_ID") or config.razorpay_key_id or ""
    key_secret = os.getenv("RAZORPAY_KEY_SECRET") or config.razorpay_key_secret or ""
    if not key_id.startswith("rzp_test_"):
        raise RuntimeError("RAZORPAY_KEY_ID must be a Test Mode key beginning with rzp_test_.")
    if not key_secret:
        raise RuntimeError("RAZORPAY_KEY_SECRET is required locally to create Test Mode orders.")
    return key_id, key_secret


def backend_url(args: argparse.Namespace) -> str:
    return (args.backend_url or os.getenv("REVEN_API_URL") or DEFAULT_BACKEND_URL).rstrip("/")


def preflight_backend(url: str) -> None:
    with httpx.Client(timeout=20) as client:
        health = client.get(f"{url}/health")
        health.raise_for_status()
        readiness = client.get(f"{url}/health/readiness")
        readiness.raise_for_status()
    readiness_data = readiness.json()
    checks = {item["name"]: item["status"] for item in readiness_data.get("checks", [])}
    if checks.get("Razorpay Test Mode credentials") != "ready":
        raise RuntimeError("Backend is not ready with Razorpay Test Mode credentials; refusing to create any batch.")
    if checks.get("Razorpay webhook secret") != "ready":
        raise RuntimeError("Backend webhook verification is not ready; refusing to create unprovable payment evidence.")


def request_order(case: dict[str, Any], batch_id: str, key_id: str, key_secret: str) -> dict[str, Any]:
    receipt_suffix = sha256(case["case_id"].encode()).hexdigest()[:14]
    payload = {
        "amount": int(case["amount"] * 100),
        "currency": "INR",
        "receipt": f"reven-{receipt_suffix}",
        "notes": {
            "reven_batch_id": batch_id,
            "reven_case_id": case["case_id"],
            "customer_name": case["customer_name"],
            "expected_scenario": case["scenario"],
        },
    }
    with httpx.Client(timeout=25, auth=(key_id, key_secret)) as client:
        response = client.post(f"{RAZORPAY_API}/orders", json=payload)
        response.raise_for_status()
        return response.json()


def write_failure_checkout_board(path: Path, manifest: dict[str, Any], key_id: str) -> None:
    rows = []
    for case in manifest["cases"]:
        order = case.get("order")
        if not order:
            continue
        guide = next(detail for name, _, detail in SCENARIOS if name == case["scenario"]) if case["scenario"] != "trust_gate_rapid_repeat" else "Use the same contact and choose Failure. Cases 6–8 should trigger Trust Gate."
        rows.append(
            "<article class='case'>"
            f"<h2>#{case['index']:03d} · ₹{case['amount']:,}</h2>"
            f"<p><b>{case['scenario']}</b> → expected <code>{case['expected_error_reason']}</code></p>"
            f"<p>{guide}</p>"
            f"<p class='muted'>Contact: {case['contact']} · Order: {order['id']}</p>"
            f"<button data-case='{json.dumps(case).replace(chr(39), '&#39;')}'>Open Test Checkout</button>"
            "</article>"
        )
    html = f"""<!doctype html><html><head><meta charset='utf-8'><title>Reven Test Batch {manifest['batch_id']}</title>
<style>body{{font-family:system-ui;background:#070908;color:#eee;margin:32px}}main{{max-width:1000px;margin:auto}}.case{{border:1px solid #243126;padding:16px;margin:12px 0;background:#0d110e}}button{{background:#27e38b;border:0;padding:10px 14px;font-weight:700;cursor:pointer}}code,.muted{{color:#a7cdb8}}</style>
<script src='https://checkout.razorpay.com/v1/checkout.js'></script></head><body><main><h1>Reven · real Razorpay Test Mode failure batch</h1><p>Choose the documented Test Mode failure path for each row. This board never sends a webhook; Razorpay sends it to your configured endpoint.</p>{''.join(rows)}</main>
<script>const key={json.dumps(key_id)}; document.querySelectorAll('button[data-case]').forEach(button=>button.onclick=()=>{{const c=JSON.parse(button.dataset.case); const o=c.order; new Razorpay({{key,amount:o.amount,currency:'INR',name:'Reven Test Batch',description:c.scenario,order_id:o.id,prefill:{{name:c.customer_name,contact:c.contact,email:`${{c.contact}}@example.test`}},notes:{{reven_batch_id:{json.dumps(manifest['batch_id'])},reven_case_id:c.case_id,customer_name:c.customer_name,reven_retry_count:'0'}}}}).open();}});</script></body></html>"""
    path.write_text(html, encoding="utf-8")


def fetch_order_payments(order_id: str, key_id: str, key_secret: str) -> list[dict[str, Any]]:
    with httpx.Client(timeout=20, auth=(key_id, key_secret)) as client:
        response = client.get(f"{RAZORPAY_API}/orders/{order_id}/payments")
        response.raise_for_status()
        return response.json().get("items", [])


def enrich_with_actual_payment(manifest: dict[str, Any], key_id: str, key_secret: str) -> None:
    for case in manifest["cases"]:
        order = case.get("order")
        if not order:
            continue
        payments = fetch_order_payments(order["id"], key_id, key_secret)
        failed = next((payment for payment in reversed(payments) if payment.get("status") == "failed"), None)
        if failed:
            case["actual_payment"] = {
                "id": failed["id"],
                "event_id": f"rzp_{failed['id']}",
                "status": failed["status"],
                "error_reason": failed.get("error_reason"),
                "error_description": failed.get("error_description"),
            }


def fetch_case_result(api_url: str, event_id: str) -> dict[str, Any] | None:
    with httpx.Client(timeout=20) as client:
        response = client.get(f"{api_url}/events/{event_id}")
        return response.json() if response.status_code == 200 else None


def prepare_recovery_links(manifest: dict[str, Any], api_url: str, limit: int, admin_token: str | None, include_escalations: bool) -> int:
    created = 0
    with httpx.Client(timeout=30) as client:
        for case in manifest["cases"]:
            if created >= limit or case.get("recovery_link"):
                continue
            actual = case.get("actual_payment")
            if not actual:
                continue
            detail = fetch_case_result(api_url, actual["event_id"])
            result = (detail or {}).get("pipeline_result") or {}
            if result.get("trust_gate", {}).get("status") == "suspicious":
                continue
            action = result.get("decision", {}).get("action")
            if action == "create_payment_link":
                response = client.post(f"{api_url}/recovery/payment-link", json={"event_id": actual["event_id"]})
            elif include_escalations and action == "escalate_human" and admin_token:
                response = client.post(
                    f"{api_url}/recovery/payment-link/approve",
                    headers={"X-Admin-Token": admin_token},
                    json={"event_id": actual["event_id"], "approval_note": f"Test batch {manifest['batch_id']} operator-reviewed recovery"},
                )
            else:
                continue
            if response.status_code in {200, 201}:
                case["recovery_link"] = response.json()
                created += 1
            elif response.status_code != 409:
                print(f"Could not prepare recovery for {actual['event_id']}: {response.status_code} {response.text}", file=sys.stderr)
    return created


def write_recovery_board(path: Path, manifest: dict[str, Any]) -> None:
    items = [case for case in manifest["cases"] if case.get("recovery_link", {}).get("short_url")]
    links = "".join(f"<li><a href='{case['recovery_link']['short_url']}' target='_blank'>Case #{case['index']:03d} · ₹{case['amount']:,}</a></li>" for case in items)
    path.write_text(
        f"<!doctype html><title>Reven recovery links</title><body><h1>Complete these recovery links in Razorpay Test Mode</h1><p>Select Success on the mock checkout. Razorpay must deliver the genuine <code>payment_link.paid</code> webhook before Reven counts recovery.</p><ol>{links}</ol></body>",
        encoding="utf-8",
    )


def report(manifest: dict[str, Any], api_url: str) -> None:
    with httpx.Client(timeout=20) as client:
        response = client.get(f"{api_url}/batches/{manifest['batch_id']}/summary")
    response.raise_for_status()
    summary = response.json()
    print(json.dumps({
        "batch_id": summary["batch_id"],
        "planned_cases": len(manifest["cases"]),
        "total_cases": summary["total_cases"],
        "trust_gate_blocks": summary["trust_gate_blocks"],
        "human_review_escalations": summary["human_review_escalations"],
        "verified_recoveries": summary["verified_recovery_count"],
        "total_verified_inr": summary["verified_recovery_amount"],
        "diagnosis_labelled_cases": summary["diagnosis_labelled_cases"],
        "diagnosis_accuracy_pct": summary["diagnosis_accuracy_pct"],
    }, indent=2))


def command_plan(args: argparse.Namespace) -> None:
    manifest_path, _, _ = batch_paths(args.batch_id, Path(args.output_dir))
    if manifest_path.exists():
        print(f"Existing manifest retained: {manifest_path}")
        return
    manifest = {"batch_id": safe_batch_id(args.batch_id), "created_at": utc_now(), "mode": "razorpay_test_mode_real_webhooks", "cases": [asdict(item) for item in make_plan(args.batch_id, args.count)]}
    save_manifest(manifest_path, manifest)
    print(f"Created plan for {args.count} real Test Mode checkout attempts: {manifest_path}")
    print("Eight cases share one fictional contact; after five failures, cases 6–8 should be blocked by Trust Gate.")


def command_create_orders(args: argparse.Namespace) -> None:
    if not args.apply:
        raise RuntimeError("Refusing external API writes. Re-run with --apply after reviewing the plan.")
    key_id, key_secret = require_test_key()
    api_url = backend_url(args)
    preflight_backend(api_url)
    manifest_path, checkout_path, _ = batch_paths(args.batch_id, Path(args.output_dir))
    manifest = load_manifest(manifest_path)
    created = 0
    for case in manifest["cases"]:
        if case.get("order"):
            continue
        case["order"] = request_order(case, manifest["batch_id"], key_id, key_secret)
        created += 1
        save_manifest(manifest_path, manifest)
    write_failure_checkout_board(checkout_path, manifest, key_id)
    print(f"Created {created} Test Mode orders. Open {checkout_path.resolve()} and complete each failure manually.")


def command_status(args: argparse.Namespace) -> None:
    key_id, key_secret = require_test_key()
    manifest_path, _, _ = batch_paths(args.batch_id, Path(args.output_dir))
    manifest = load_manifest(manifest_path)
    enrich_with_actual_payment(manifest, key_id, key_secret)
    save_manifest(manifest_path, manifest)
    report(manifest, backend_url(args))


def command_prepare_recoveries(args: argparse.Namespace) -> None:
    if not args.apply:
        raise RuntimeError("Refusing to create recovery links. Re-run with --apply after reviewing current case decisions.")
    key_id, key_secret = require_test_key()
    api_url = backend_url(args)
    preflight_backend(api_url)
    manifest_path, _, recovery_path = batch_paths(args.batch_id, Path(args.output_dir))
    manifest = load_manifest(manifest_path)
    enrich_with_actual_payment(manifest, key_id, key_secret)
    admin_token = os.getenv("ADMIN_TOKEN") or get_config().admin_token
    created = prepare_recovery_links(manifest, api_url, args.limit, admin_token, args.include_escalations)
    save_manifest(manifest_path, manifest)
    write_recovery_board(recovery_path, manifest)
    print(f"Prepared {created} recovery links. Open {recovery_path.resolve()} and manually select Success in Razorpay Test Mode.")
    print("Do not use /reconcile for pitch evidence unless the signed payment_link.paid webhook has failed to arrive.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a real, manual Razorpay Test Mode recovery batch without forged webhooks.")
    parser.add_argument("command", choices=("plan", "create-orders", "status", "prepare-recoveries", "report"))
    parser.add_argument("--batch-id", required=True)
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--limit", type=int, default=8, help="Recovery links to prepare (recommended: 5–10).")
    parser.add_argument("--backend-url", help="Defaults to REVEN_API_URL or the deployed Reven API.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--apply", action="store_true", help="Required before any Razorpay order or recovery-link creation.")
    parser.add_argument("--include-escalations", action="store_true", help="Use ADMIN_TOKEN to approve selected human-review cases; omitted by default.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "plan":
            command_plan(args)
        elif args.command == "create-orders":
            command_create_orders(args)
        elif args.command == "status":
            command_status(args)
        elif args.command == "prepare-recoveries":
            command_prepare_recoveries(args)
        else:
            manifest_path, _, _ = batch_paths(args.batch_id, Path(args.output_dir))
            report(load_manifest(manifest_path), backend_url(args))
    except (RuntimeError, FileNotFoundError, ValueError, httpx.HTTPError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
