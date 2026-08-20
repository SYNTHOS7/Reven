from app.evaluation import run_evaluation
from app.repository import Repository


def test_empty_repository_does_not_fabricate_metrics() -> None:
    repo = Repository()
    response = run_evaluation(repo)
    assert response.scorecard.total_cases == 0
    assert response.scorecard.labeled_cases == 0
    assert response.scorecard.diagnosis_accuracy_pct == 0
    assert response.results == []
