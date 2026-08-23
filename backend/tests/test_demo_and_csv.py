from app.demo_transactions import DemoDatasetStore, derive_intelligence
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_demo_dataset_seeded_properties():
    store = DemoDatasetStore()
    assert len(store.transactions) == 500

    lost = sum(t.amount for t in store.transactions if t.status in ("failed", "abandoned"))
    recovered = sum(t.amount for t in store.transactions if t.status == "recovered")

    # Verify ~1.40L lost revenue and ~46K recovered revenue
    assert 135000 <= lost <= 145000
    assert 44000 <= recovered <= 48000

    # Verify card failures are the dominant pattern
    card_fails = sum(
        1 for t in store.transactions if t.status in ("failed", "abandoned") and t.payment_method == "card"
    )
    total_fails = sum(1 for t in store.transactions if t.status in ("failed", "abandoned"))
    assert (card_fails / total_fails) > 0.55


def test_derive_intelligence():
    # Insufficient funds
    res = derive_intelligence("insufficient_funds", "card", 4999, 1, "failed")
    assert "Insufficient" in res["likely_root_cause"] or "Limit" in res["likely_root_cause"]
    assert "UPI" in res["recommended_action"] or "Retry" in res["recommended_action"]
    assert res["recovery_probability"] >= 70

    # Bank decline
    res2 = derive_intelligence("bank_decline", "card", 9999, 1, "failed")
    assert "3DS" in res2["likely_root_cause"] or "Decline" in res2["likely_root_cause"]
    assert res2["is_high_priority"] is True

    # Technical failure
    res3 = derive_intelligence("technical_failure", "upi", 1999, 0, "failed")
    assert "payment link" in res3["recommended_action"].lower()
    assert res3["recovery_probability"] >= 85


def test_demo_api_endpoints():
    # 1. Get demo transactions
    resp = client.get("/data/demo/transactions?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 10
    assert data["total"] == 500

    # 2. Get demo revenue metrics
    metrics_resp = client.get("/metrics/revenue-intelligence-demo")
    assert metrics_resp.status_code == 200
    mdata = metrics_resp.json()
    assert mdata["total_attempted_revenue"] > 500000
    assert 135000 <= mdata["revenue_lost"] <= 145000
    assert 44000 <= mdata["revenue_recovered"] <= 48000

    # 3. Simulate single action
    failed_tx = next(t for t in data["items"] if t["status"] == "failed")
    action_resp = client.post(
        "/recovery/demo/action",
        json={"transaction_id": failed_tx["transaction_id"], "action_type": "mark_recovered"},
    )
    assert action_resp.status_code == 200
    assert action_resp.json()["transaction"]["status"] == "recovered"

    # 4. Batch recover all high priority
    batch_resp = client.post("/recovery/demo/recover-all")
    assert batch_resp.status_code == 200
    assert batch_resp.json()["recovered_count"] > 0
