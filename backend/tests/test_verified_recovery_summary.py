from fastapi.testclient import TestClient

import app.main as main
from app.config import AppConfig
from app.repository import Repository


def test_verified_recovery_summary_matches_latest_evaluation(monkeypatch) -> None:
    """The public proof total and scorecard must share one recovery-attribution source."""
    isolated_repository = Repository(AppConfig())
    isolated_repository.record_recovery("event-one", "plink-one", 100)
    isolated_repository.record_recovery("event-two", "plink-two", 101)
    monkeypatch.setattr(main, "repository", isolated_repository)

    with TestClient(main.app) as client:
        summary_response = client.get("/evidence/verified-recovery")
        scorecard_response = client.get("/eval/latest")

    assert summary_response.status_code == 200
    assert scorecard_response.status_code == 200
    summary = summary_response.json()
    scorecard = scorecard_response.json()
    assert summary["verified_recovery_amount"] == 201
    assert summary["verified_recovery_count"] == 2
    assert scorecard["actual_test_recovery"] == summary["verified_recovery_amount"]
