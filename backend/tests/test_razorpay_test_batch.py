from scripts.run_razorpay_test_batch import TRUST_GATE_RAPID_CASES, make_plan
from app.config import AppConfig
from app.razorpay_client import RazorpayClient


def test_real_test_mode_batch_plan_has_required_trust_gate_evidence() -> None:
    cases = make_plan("batch-proof", 30)

    assert len(cases) == 30
    rapid_repeat_cases = [case for case in cases if case.trust_gate_fixture]
    assert len(rapid_repeat_cases) == TRUST_GATE_RAPID_CASES
    assert len({case.contact for case in rapid_repeat_cases}) == 1
    assert {case.amount for case in cases if not case.trust_gate_fixture and case.amount >= 5000}
    assert {case.scenario for case in cases} >= {
        "soft_decline",
        "insufficient_funds",
        "otp_drop",
        "unsupported_card",
        "generic_processor_failure",
    }


def test_razorpay_client_rejects_live_key_for_test_batch_operations() -> None:
    client = RazorpayClient(AppConfig(razorpay_key_id="rzp_live_example", razorpay_key_secret="secret"))

    try:
        client._require_test_mode()
    except RuntimeError as exc:
        assert "rzp_test_" in str(exc)
    else:
        raise AssertionError("A live Razorpay key must never run Test Mode batch operations")
