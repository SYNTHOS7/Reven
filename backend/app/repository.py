import hashlib
from threading import Lock

import httpx

from app.config import AppConfig, get_config
from app.models import PaymentEvent, PipelineResult, PolicySettings, ScorecardRun


class Repository:
    """Local working set backed by Supabase when production credentials exist."""

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or get_config()
        self.events: list[PaymentEvent] = []
        self.results: list[PipelineResult] = []
        self.scorecards: list[ScorecardRun] = []
        self.policy = PolicySettings()
        self.processed_webhook_ids: set[str] = set()
        self.valid_webhooks_processed = 0
        self.duplicate_webhooks_ignored = 0
        self.invalid_webhooks_rejected = 0
        self.actual_test_recovery = 0.0
        self.completed_recoveries: dict[str, float] = {}
        self.storage_error: str | None = None
        self._lock = Lock()
        if self.persistent:
            self._load_remote()

    @property
    def persistent(self) -> bool:
        return self.config.supabase_configured

    @property
    def storage_mode(self) -> str:
        if self.storage_error:
            return "supabase_error"
        return "supabase" if self.persistent else "memory"

    def _headers(self, prefer: str | None = None) -> dict[str, str]:
        key = self.config.supabase_service_role_key or ""
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        if prefer:
            headers["Prefer"] = prefer
        return headers

    def _url(self, path: str) -> str:
        return f"{(self.config.supabase_url or '').rstrip('/')}/rest/v1/{path}"

    def _load_remote(self) -> None:
        try:
            with httpx.Client(timeout=12) as client:
                event_rows = client.get(
                    self._url("reven_events?select=payload&order=created_at.asc&limit=500"), headers=self._headers()
                )
                event_rows.raise_for_status()
                self.events = [PaymentEvent.model_validate(row["payload"]) for row in event_rows.json()]

                result_rows = client.get(
                    self._url("pipeline_results?select=payload&order=created_at.desc&limit=500"), headers=self._headers()
                )
                result_rows.raise_for_status()
                self.results = [PipelineResult.model_validate(row["payload"]) for row in result_rows.json()]

                scorecard_rows = client.get(
                    self._url("scorecard_runs?select=payload&order=created_at.asc&limit=100"), headers=self._headers()
                )
                scorecard_rows.raise_for_status()
                self.scorecards = [ScorecardRun.model_validate(row["payload"]) for row in scorecard_rows.json()]

                setting_rows = client.get(
                    self._url("reven_settings?id=eq.active&select=payload"), headers=self._headers()
                )
                setting_rows.raise_for_status()
                if setting_rows.json():
                    self.policy = PolicySettings.model_validate(setting_rows.json()[0]["payload"])

                recovery_rows = client.get(
                    self._url("recovery_attempts?select=event_id,external_reference,status,amount_recovered,created_at"), headers=self._headers()
                )
                recovery_rows.raise_for_status()
                recoveries = recovery_rows.json()
                self.completed_recoveries = {}
                for row in recoveries:
                    if row.get("status") != "completed":
                        continue
                    recovery_key = str(row.get("event_id") or row.get("external_reference") or "")
                    if recovery_key:
                        self.completed_recoveries[recovery_key] = float(row.get("amount_recovered", 0))
                self.actual_test_recovery = sum(self.completed_recoveries.values())
                self._hydrate_recovery_state(recoveries)
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            self.storage_error = str(exc)

    def _hydrate_recovery_state(self, recoveries: list[dict]) -> None:
        """Carry durable recovery evidence into every evaluation of the same event."""
        for recovery in recoveries:
            event_id = recovery.get("event_id")
            if not event_id:
                continue
            for result in self.results:
                if result.event_id != event_id:
                    continue
                if recovery.get("external_reference") and not result.razorpay_payment_link_id:
                    result.razorpay_payment_link_id = str(recovery["external_reference"])
                if recovery.get("status") == "completed":
                    result.verified_recovered_amount = max(
                        result.verified_recovered_amount,
                        float(recovery.get("amount_recovered", 0)),
                    )

    def _preserve_recovery_state(self, results: list[PipelineResult]) -> None:
        """A fresh diagnosis must not erase a prepared or verified recovery."""
        by_event: dict[str, list[PipelineResult]] = {}
        for existing in self.results:
            by_event.setdefault(existing.event_id, []).append(existing)
        for result in results:
            prior = by_event.get(result.event_id, [])
            payment_link_id = next(
                (item.razorpay_payment_link_id for item in sorted(prior, key=lambda item: item.created_at, reverse=True) if item.razorpay_payment_link_id),
                None,
            )
            prior_recovered_at = next(
                (item.recovered_at for item in sorted(prior, key=lambda item: item.created_at, reverse=True) if item.recovered_at),
                None,
            )
            if payment_link_id and not result.razorpay_payment_link_id:
                result.razorpay_payment_link_id = payment_link_id
            if prior_recovered_at and not result.recovered_at:
                result.recovered_at = prior_recovered_at
            result.verified_recovered_amount = max(
                result.verified_recovered_amount,
                *(item.verified_recovered_amount for item in prior),
            ) if prior else result.verified_recovered_amount

    def save_event(self, event: PaymentEvent) -> None:
        existing_index = next((index for index, item in enumerate(self.events) if item.id == event.id), None)
        if existing_index is None:
            self.events.append(event)
        else:
            self.events[existing_index] = event
        if not self.persistent:
            return
        response = httpx.post(
            self._url("reven_events?on_conflict=id"),
            headers=self._headers("resolution=merge-duplicates,return=minimal"),
            json={"id": event.id, "source": event.source, "source_event_id": event.source_event_id, "payload": event.model_dump(mode="json")},
            timeout=12,
        )
        response.raise_for_status()

    def save_results(self, results: list[PipelineResult]) -> None:
        self._preserve_recovery_state(results)
        result_ids = {item.id for item in results}
        self.results = [item for item in self.results if item.id not in result_ids] + results
        if not self.persistent or not results:
            return
        response = httpx.post(
            self._url("pipeline_results?on_conflict=id"),
            headers=self._headers("resolution=merge-duplicates,return=minimal"),
            json=[{"id": item.id, "run_id": item.run_id, "event_id": item.event_id, "payload": item.model_dump(mode="json")} for item in results],
            timeout=20,
        )
        response.raise_for_status()

    def save_scorecard(self, scorecard: ScorecardRun) -> None:
        self.scorecards.append(scorecard)
        if not self.persistent:
            return
        response = httpx.post(
            self._url("scorecard_runs"), headers=self._headers("return=minimal"),
            json={"id": scorecard.id, "payload": scorecard.model_dump(mode="json")}, timeout=12,
        )
        response.raise_for_status()

    def save_policy(self) -> None:
        if not self.persistent:
            return
        response = httpx.post(
            self._url("reven_settings?on_conflict=id"),
            headers=self._headers("resolution=merge-duplicates,return=minimal"),
            json={"id": "active", "payload": self.policy.model_dump(mode="json")}, timeout=12,
        )
        response.raise_for_status()

    def mark_webhook_processed(self, event_id: str, event_type: str = "unknown", body: bytes = b"") -> bool:
        with self._lock:
            if event_id in self.processed_webhook_ids:
                self.duplicate_webhooks_ignored += 1
                return False
            if self.persistent:
                response = httpx.post(
                    self._url("webhook_events"), headers=self._headers("return=minimal"),
                    json={"razorpay_event_id": event_id, "event_type": event_type, "payload_hash": hashlib.sha256(body).hexdigest()},
                    timeout=12,
                )
                if response.status_code == 409:
                    self.duplicate_webhooks_ignored += 1
                    return False
                response.raise_for_status()
            self.processed_webhook_ids.add(event_id)
            self.valid_webhooks_processed += 1
            return True

    def record_rejected_webhook(self) -> None:
        with self._lock:
            self.invalid_webhooks_rejected += 1

    def record_recovery(self, event_id: str | None, external_reference: str | None, amount: float) -> None:
        recovery_key = str(event_id or external_reference or "")
        if not recovery_key or recovery_key in self.completed_recoveries:
            return
        if self.persistent:
            response = httpx.post(
                self._url("recovery_attempts"), headers=self._headers("return=minimal"),
                json={"event_id": event_id, "external_reference": external_reference, "action": "create_payment_link", "status": "completed", "amount_recovered": amount},
                timeout=12,
            )
            response.raise_for_status()
        self.completed_recoveries[recovery_key] = amount
        self.actual_test_recovery = sum(self.completed_recoveries.values())

    def verified_recovery_summary(self) -> tuple[float, int]:
        """Return the aggregate that public UI must use for verified recovery."""
        return self.actual_test_recovery, len(self.completed_recoveries)

    def record_prepared_recovery(self, event_id: str, external_reference: str) -> None:
        if not self.persistent:
            return
        response = httpx.post(
            self._url("recovery_attempts"), headers=self._headers("return=minimal"),
            json={"event_id": event_id, "external_reference": external_reference, "action": "create_payment_link", "status": "prepared", "amount_recovered": 0},
            timeout=12,
        )
        response.raise_for_status()



InMemoryRepository = Repository
repository = Repository()
