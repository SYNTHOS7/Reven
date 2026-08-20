from app.repository import InMemoryRepository


def test_duplicate_webhook_is_idempotent() -> None:
    repo = InMemoryRepository()
    assert repo.mark_webhook_processed("hook_1") is True
    assert repo.mark_webhook_processed("hook_1") is False
