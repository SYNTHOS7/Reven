from datetime import datetime, timezone
import random
from typing import Literal
from pydantic import BaseModel, Field

TransactionStatus = Literal["successful", "failed", "abandoned", "recovered"]
DemoActionType = Literal[
    "not_started",
    "preview_whatsapp",
    "preview_email",
    "create_payment_link",
    "recommend_alternative",
    "escalate_high_value",
    "mark_recovered",
]


class DemoTransaction(BaseModel):
    transaction_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    amount: float
    currency: str = "INR"
    status: TransactionStatus
    payment_method: str
    failure_reason: str
    attempted_at: str
    retry_count: int = 0
    likely_root_cause: str | None = None
    recovery_probability: int | None = None
    recommended_action: str | None = None
    action_status: DemoActionType = "not_started"
    action_note: str | None = None
    simulated_link: str | None = None
    recovered_at: str | None = None
    is_high_priority: bool = False


FIRST_NAMES = [
    "Aarav", "Aditi", "Rohan", "Priya", "Vikram", "Ananya", "Rahul", "Sneha", "Karan", "Pooja",
    "Arjun", "Kavya", "Siddharth", "Neha", "Manish", "Divya", "Varun", "Ritu", "Deepak", "Swati",
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Mehta", "Iyer", "Nair", "Reddy", "Gupta", "Kulkarni", "Deshmukh",
    "Chopra", "Singh", "Bose", "Menon", "Joshi", "Bhat", "Rao", "Malhotra", "Pandey", "Kapoor",
]

COURSE_TIERS = [
    {"name": "Prompt Engineering & GenAI Workshop", "amount": 999},
    {"name": "Python for Data Science & ML", "amount": 1999},
    {"name": "Frontend Architecture & Next.js", "amount": 2499},
    {"name": "System Design & Distributed Systems", "amount": 3499},
    {"name": "Cloud Architecture & DevOps Masterclass", "amount": 4999},
    {"name": "AI & Fullstack Engineering Accelerator", "amount": 9999},
    {"name": "Executive AI Leadership Cohort", "amount": 14999},
]


def derive_intelligence(
    failure_reason: str,
    payment_method: str,
    amount: float,
    retry_count: int,
    status: str,
) -> dict:
    reason = (failure_reason or "").lower()
    method = (payment_method or "").lower()

    if retry_count >= 3 or "repeated" in reason:
        likely_root_cause = f"Multi-attempt Recurring Rejection ({retry_count} attempts)"
        recommended_action = "Escalate to human review"
        recovery_probability = 42
    elif "insufficient" in reason or "balance" in reason or "limit" in reason:
        likely_root_cause = "Credit Card Limit Exhausted" if method == "card" else "Bank Account Balance Insufficient"
        recommended_action = "Retry later (scheduled) / Offer UPI instant switch"
        recovery_probability = 72
    elif "bank_decline" in reason or "decline" in reason or "do_not_honor" in reason:
        likely_root_cause = "Issuer Bank 3DS / Risk Decline"
        recommended_action = "Recommend alternative payment method (UPI / Netbanking) / Retry later"
        recovery_probability = 78
    elif "tech" in reason or "network" in reason or "timeout" in reason or "gateway" in reason:
        likely_root_cause = "Gateway Network Glitch / Peak Load Drop"
        recommended_action = "Create simulated retry-payment link"
        recovery_probability = 91
    elif "auth" in reason or "otp" in reason or "3ds" in reason:
        likely_root_cause = "SMS OTP Timeout / Verification Abandonment"
        recommended_action = "Retry with supported method (UPI Intent / Biometric)"
        recovery_probability = 84
    elif "missing" in reason or "unsupported" in reason:
        likely_root_cause = "Customer Preferred Payment Rail Not Supported"
        recommended_action = "Recommend UPI or Digital Wallet"
        recovery_probability = 76
    elif status == "abandoned" or "abandon" in reason:
        likely_root_cause = "Checkout Window Closed Before Completion"
        recommended_action = "Send gentle reminder with discount/perk"
        recovery_probability = 64
    else:
        likely_root_cause = "General Card/Bank Processing Failure"
        recommended_action = "Escalate for manual inspection"
        recovery_probability = 50

    is_high_priority = (
        status not in ("successful", "recovered")
        and (amount >= 4000 or recovery_probability >= 78)
    )

    return {
        "likely_root_cause": likely_root_cause,
        "recovery_probability": recovery_probability,
        "recommended_action": recommended_action,
        "is_high_priority": is_high_priority,
    }


class DemoDatasetStore:
    def __init__(self):
        self.transactions: list[DemoTransaction] = []
        self.seed_demo_data()

    def seed_demo_data(self):
        rng = random.Random(1337)
        txs: list[DemoTransaction] = []
        dates = [
            "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14",
            "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19",
            "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"
        ]

        id_counter = 1000

        def make_cust():
            fn = rng.choice(FIRST_NAMES)
            ln = rng.choice(LAST_NAMES)
            email = f"{fn.lower()}.{ln.lower()}{rng.randint(10, 99)}@gmail.com"
            phone = f"+91 98{rng.randint(10000000, 99999999)}"
            return f"{fn} {ln}", email, phone

        # 1. Seed ~₹46,000 recovered transactions
        rec_amounts = [14999, 9999, 4999, 4999, 3499, 2499, 1999, 1499, 999, 999]
        curr_rec = 0
        target_rec = 46000
        for i in range(20):
            if curr_rec >= target_rec:
                break
            id_counter += 1
            name, email, phone = make_cust()
            amt = rec_amounts[i % len(rec_amounts)]
            if curr_rec + amt > target_rec + 1000:
                amt = target_rec - curr_rec
                if amt <= 0:
                    break
            curr_rec += amt
            intel = derive_intelligence("bank_decline", "card", amt, 1, "recovered")
            txs.append(
                DemoTransaction(
                    transaction_id=f"txn_rec_{id_counter}",
                    customer_name=name,
                    customer_email=email,
                    customer_phone=phone,
                    amount=float(amt),
                    currency="INR",
                    status="recovered",
                    payment_method="card" if i % 2 == 0 else "upi",
                    failure_reason="bank_decline",
                    attempted_at=f"{dates[i % len(dates)]}T11:15:00Z",
                    retry_count=1,
                    action_status="mark_recovered",
                    action_note="Recovered via simulated UPI payment link",
                    simulated_link=f"https://pay.reven.ai/rec/txn_rec_{id_counter}",
                    recovered_at=f"{dates[i % len(dates)]}T12:30:00Z",
                    **intel,
                )
            )

        # 2. Seed ~₹1,40,000 lost revenue transactions (card dominant)
        fail_types = [
            ("card", "bank_decline"),
            ("card", "insufficient_funds"),
            ("card", "authentication_failure"),
            ("card", "repeated_failure"),
            ("upi", "technical_failure"),
            ("checkout", "abandoned"),
            ("netbanking", "missing_payment_option"),
        ]
        high_tiers = [14999, 9999, 9999, 4999, 4999, 4999, 3499, 3499, 2499, 2499, 1999, 999]
        curr_lost = 0
        target_lost = 140000
        fail_idx = 0
        while curr_lost < target_lost:
            id_counter += 1
            fail_idx += 1
            name, email, phone = make_cust()
            chosen_amt = high_tiers[fail_idx % len(high_tiers)]
            needed = target_lost - curr_lost
            final_amt = min(needed, chosen_amt)
            curr_lost += final_amt

            method, reason = fail_types[fail_idx % len(fail_types)]
            status = "abandoned" if reason == "abandoned" else "failed"
            retries = 3 if reason == "repeated_failure" else rng.randint(0, 2)
            intel = derive_intelligence(reason, method, final_amt, retries, status)

            txs.append(
                DemoTransaction(
                    transaction_id=f"txn_fail_{id_counter}",
                    customer_name=name,
                    customer_email=email,
                    customer_phone=phone,
                    amount=float(final_amt),
                    currency="INR",
                    status=status,
                    payment_method=method,
                    failure_reason=reason,
                    attempted_at=f"{dates[fail_idx % len(dates)]}T14:30:00Z",
                    retry_count=retries,
                    action_status="not_started",
                    **intel,
                )
            )

        # 3. Seed remaining successful transactions to reach ~500 total
        remaining = 500 - len(txs)
        for i in range(remaining):
            id_counter += 1
            name, email, phone = make_cust()
            tier = rng.choice(COURSE_TIERS)
            method = rng.choice(["upi", "upi", "card", "card", "netbanking"])
            txs.append(
                DemoTransaction(
                    transaction_id=f"txn_succ_{id_counter}",
                    customer_name=name,
                    customer_email=email,
                    customer_phone=phone,
                    amount=float(tier["amount"]),
                    currency="INR",
                    status="successful",
                    payment_method=method,
                    failure_reason="none",
                    attempted_at=f"{dates[i % len(dates)]}T09:00:00Z",
                    retry_count=0,
                    action_status="not_started",
                )
            )

        txs.sort(key=lambda t: t.attempted_at, reverse=True)
        self.transactions = txs
        return len(self.transactions)


demo_store = DemoDatasetStore()
