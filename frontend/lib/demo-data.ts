import { deriveTransactionIntelligence } from "./recovery-logic";
import type { CSVValidationResult, Transaction, TransactionStatus } from "./types";

const FIRST_NAMES = [
  "Aarav", "Aditi", "Rohan", "Priya", "Vikram", "Ananya", "Rahul", "Sneha", "Karan", "Pooja",
  "Arjun", "Kavya", "Siddharth", "Neha", "Manish", "Divya", "Varun", "Ritu", "Deepak", "Swati",
  "Nikhil", "Shreya", "Aditya", "Meera", "Gaurav", "Tanvi", "Amit", "Ishaan", "Simran", "Akash",
  "Rhea", "Harsh", "Priyanka", "Mayank", "Shilpa", "Kunal", "Tara", "Yash", "Zoya", "Dev",
  "Alisha", "Rajesh", "Sunita", "Pranav", "Nidhi", "Sameer", "Preeti", "Tarun", "Komal", "Abhishek"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Mehta", "Iyer", "Nair", "Reddy", "Gupta", "Kulkarni", "Deshmukh",
  "Chopra", "Singh", "Bose", "Menon", "Joshi", "Bhat", "Rao", "Malhotra", "Pandey", "Kapoor",
  "Saxena", "Agarwal", "Choudhury", "Das", "Mukherjee", "Nambiar", "Pillai", "Shah", "Mishra", "Tiwari"
];

const COURSE_TIERS = [
  { name: "Prompt Engineering & GenAI Workshop", amount: 999 },
  { name: "Python for Data Science & ML", amount: 1999 },
  { name: "Frontend Architecture & Next.js", amount: 2499 },
  { name: "System Design & Distributed Systems", amount: 3499 },
  { name: "Cloud Architecture & DevOps Masterclass", amount: 4999 },
  { name: "AI & Fullstack Engineering Accelerator", amount: 9999 },
  { name: "Executive AI Leadership Cohort", amount: 14999 },
];

// Seeded pseudorandom number generator for reproducible demo data
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSeededDemoTransactions(): Transaction[] {
  const rand = mulberry32(1337);
  const transactions: Transaction[] = [];

  // Goal metrics:
  // - Total ~500 transactions
  // - Lost revenue: exact/close to ₹1,40,000 (failed + abandoned)
  // - Recovered revenue: exact/close to ₹46,000
  // - Collected revenue: ~₹4,50,000
  // - Heavy card failure pattern (>65% of failures)
  // - High-priority recovery items

  const dates = [
    "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14",
    "2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19",
    "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"
  ];

  let idCounter = 1000;

  function makeCustomer(idx: number) {
    const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const name = `${fn} ${ln}`;
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${Math.floor(rand() * 89 + 10)}@gmail.com`;
    const phone = `+91 98${Math.floor(rand() * 89999999 + 10000000)}`;
    return { name, email, phone };
  }

  // 1. Generate Recovered Transactions (~₹46,000 total across ~15-20 txns)
  const recoveredAmounts = [14999, 9999, 4999, 4999, 3499, 2499, 1999, 1499, 999, 999];
  let currentRecovered = 0;
  const targetRecovered = 46000;

  for (let i = 0; i < 20 && currentRecovered < targetRecovered; i++) {
    idCounter++;
    const cust = makeCustomer(i);
    const amt = recoveredAmounts[i % recoveredAmounts.length];
    if (currentRecovered + amt > targetRecovered + 1000) {
      const remaining = targetRecovered - currentRecovered;
      if (remaining > 0) {
        currentRecovered += remaining;
        const tx: Transaction = {
          transaction_id: `txn_rec_${idCounter}`,
          customer_name: cust.name,
          customer_email: cust.email,
          customer_phone: cust.phone,
          amount: remaining,
          currency: "INR",
          status: "recovered",
          payment_method: "card",
          failure_reason: "bank_decline",
          attempted_at: `${dates[i % dates.length]}T14:22:00Z`,
          retry_count: 1,
          action_status: "mark_recovered",
          action_note: "Recovered via simulated UPI payment link",
          simulated_link: `https://pay.reven.ai/rec/txn_rec_${idCounter}`,
          recovered_at: `${dates[i % dates.length]}T16:45:00Z`,
        };
        const intel = deriveTransactionIntelligence(tx);
        transactions.push({ ...tx, ...intel });
      }
      break;
    }
    currentRecovered += amt;
    const tx: Transaction = {
      transaction_id: `txn_rec_${idCounter}`,
      customer_name: cust.name,
      customer_email: cust.email,
      customer_phone: cust.phone,
      amount: amt,
      currency: "INR",
      status: "recovered",
      payment_method: i % 3 === 0 ? "card" : "upi",
      failure_reason: i % 2 === 0 ? "insufficient_funds" : "authentication_failure",
      attempted_at: `${dates[i % dates.length]}T11:15:00Z`,
      retry_count: (i % 2) + 1,
      action_status: "mark_recovered",
      action_note: "Customer completed payment on 2nd attempt via UPI link",
      simulated_link: `https://pay.reven.ai/rec/txn_rec_${idCounter}`,
      recovered_at: `${dates[i % dates.length]}T12:30:00Z`,
    };
    const intel = deriveTransactionIntelligence(tx);
    transactions.push({ ...tx, ...intel });
  }

  // 2. Generate Failed & Abandoned Transactions (~₹1,40,000 total, ~60-70 txns)
  // Card failures will form ~70% of this
  const failureTypes = [
    // Card heavy failures (65%+)
    { method: "card", reason: "bank_decline", weight: 25 },
    { method: "card", reason: "insufficient_funds", weight: 20 },
    { method: "card", reason: "authentication_failure", weight: 15 },
    { method: "card", reason: "repeated_failure", weight: 8 },
    // Non-card failures
    { method: "upi", reason: "technical_failure", weight: 12 },
    { method: "checkout", reason: "abandoned", weight: 12 },
    { method: "netbanking", reason: "missing_payment_option", weight: 8 },
  ];

  let currentLost = 0;
  const targetLost = 140000;

  // High ticket opportunities to put in the queue
  const highTicketTiers = [14999, 9999, 9999, 4999, 4999, 4999, 3499, 3499, 2499, 2499, 1999, 999];

  let failIndex = 0;
  while (currentLost < targetLost) {
    idCounter++;
    failIndex++;
    const cust = makeCustomer(failIndex + 100);
    const chosenAmt = highTicketTiers[failIndex % highTicketTiers.length];
    const needed = targetLost - currentLost;
    const finalAmt = needed < chosenAmt ? needed : chosenAmt;
    currentLost += finalAmt;

    // Pick failure type according to weights
    const roll = Math.floor(rand() * 100);
    let cumulative = 0;
    let chosenFail = failureTypes[0];
    for (const f of failureTypes) {
      cumulative += f.weight;
      if (roll < cumulative) {
        chosenFail = f;
        break;
      }
    }

    const isAbandoned = chosenFail.reason === "abandoned";
    const status: TransactionStatus = isAbandoned ? "abandoned" : "failed";
    const retries = chosenFail.reason === "repeated_failure" ? 3 : Math.floor(rand() * 2);
    const dateStr = dates[failIndex % dates.length];
    const hour = 9 + (failIndex % 12);
    const minute = (failIndex * 7) % 60;

    const tx: Transaction = {
      transaction_id: `txn_fail_${idCounter}`,
      customer_name: cust.name,
      customer_email: cust.email,
      customer_phone: cust.phone,
      amount: finalAmt,
      currency: "INR",
      status,
      payment_method: chosenFail.method,
      failure_reason: chosenFail.reason,
      attempted_at: `${dateStr}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00Z`,
      retry_count: retries,
      action_status: "not_started",
    };

    const intel = deriveTransactionIntelligence(tx);
    transactions.push({ ...tx, ...intel });
  }

  // 3. Generate Successful Transactions to reach ~500 total transactions (~420 successful txns)
  const remainingCount = 500 - transactions.length;
  for (let i = 0; i < remainingCount; i++) {
    idCounter++;
    const cust = makeCustomer(i + 300);
    const tier = COURSE_TIERS[Math.floor(rand() * COURSE_TIERS.length)];
    const methodChoice = rand() < 0.55 ? "upi" : rand() < 0.85 ? "card" : "netbanking";
    const dateStr = dates[i % dates.length];
    const hour = 8 + (i % 14);
    const minute = (i * 11) % 60;

    const tx: Transaction = {
      transaction_id: `txn_succ_${idCounter}`,
      customer_name: cust.name,
      customer_email: cust.email,
      customer_phone: cust.phone,
      amount: tier.amount,
      currency: "INR",
      status: "successful",
      payment_method: methodChoice,
      failure_reason: "none",
      attempted_at: `${dateStr}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00Z`,
      retry_count: 0,
      action_status: "not_started",
    };

    transactions.push(tx);
  }

  // Shuffle slightly so dates and types look natural
  return transactions.sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime());
}

export function generateSampleCsvString(): string {
  const headers = [
    "transaction_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "amount",
    "currency",
    "status",
    "payment_method",
    "failure_reason",
    "attempted_at",
    "retry_count"
  ];

  const sampleRows = [
    ["txn_demo_101", "Aarav Sharma", "aarav.sharma@example.com", "+919876543210", "9999", "INR", "failed", "card", "bank_decline", "2026-08-22T10:15:00Z", "1"],
    ["txn_demo_102", "Priya Patel", "priya.patel@example.com", "+919823456789", "4999", "INR", "failed", "card", "insufficient_funds", "2026-08-22T11:20:00Z", "2"],
    ["txn_demo_103", "Rohan Mehta", "rohan.mehta@example.com", "+919811122233", "14999", "INR", "failed", "card", "authentication_failure", "2026-08-22T13:45:00Z", "1"],
    ["txn_demo_104", "Ananya Iyer", "ananya.iyer@example.com", "+919844455566", "3499", "INR", "abandoned", "checkout", "abandoned", "2026-08-22T14:30:00Z", "0"],
    ["txn_demo_105", "Vikram Nair", "vikram.nair@example.com", "+919877788899", "2499", "INR", "failed", "upi", "technical_failure", "2026-08-22T15:10:00Z", "1"],
    ["txn_demo_106", "Sneha Reddy", "sneha.reddy@example.com", "+919833344455", "9999", "INR", "recovered", "card", "bank_decline", "2026-08-22T16:00:00Z", "2"],
    ["txn_demo_107", "Karan Gupta", "karan.gupta@example.com", "+919855566677", "1999", "INR", "successful", "upi", "none", "2026-08-22T16:40:00Z", "0"],
    ["txn_demo_108", "Divya Deshmukh", "divya.d@example.com", "+919866677788", "4999", "INR", "failed", "netbanking", "missing_payment_option", "2026-08-22T17:15:00Z", "1"],
    ["txn_demo_109", "Rahul Bose", "rahul.bose@example.com", "+919899900011", "14999", "INR", "failed", "card", "repeated_failure", "2026-08-22T18:00:00Z", "3"],
    ["txn_demo_110", "Kavya Menon", "kavya.menon@example.com", "+919812345670", "999", "INR", "successful", "card", "none", "2026-08-22T18:30:00Z", "0"],
  ];

  return [headers.join(","), ...sampleRows.map(r => r.join(","))].join("\n");
}

export function parseAndValidateCSV(csvText: string): CSVValidationResult {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return {
      valid: false,
      transactions: [],
      errors: [{ row: 0, message: "The CSV file is empty." }],
      totalRows: 0,
      validRows: 0,
    };
  }

  // Parse header line
  const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
  const expectedHeaders = [
    "transaction_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "amount",
    "currency",
    "status",
    "payment_method",
    "failure_reason",
    "attempted_at",
    "retry_count",
  ];

  const missingHeaders = expectedHeaders.filter(eh => !rawHeaders.includes(eh));
  if (missingHeaders.length > 0) {
    return {
      valid: false,
      transactions: [],
      errors: [
        {
          row: 1,
          message: `Missing required CSV columns: ${missingHeaders.join(", ")}. Please use the exact schema: ${expectedHeaders.join(", ")}`,
        },
      ],
      totalRows: lines.length - 1,
      validRows: 0,
    };
  }

  const headerIndexMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerIndexMap[h] = idx;
  });

  const transactions: Transaction[] = [];
  const errors: { row: number; field?: string; message: string; value?: string }[] = [];
  const validStatuses = new Set(["successful", "failed", "abandoned", "recovered"]);

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const line = lines[i];
    // Split taking care of simple commas
    const values = parseCSVLine(line);

    if (values.length < rawHeaders.length) {
      errors.push({
        row: rowNum,
        message: `Row has only ${values.length} columns, expected ${rawHeaders.length}`,
      });
      continue;
    }

    const txId = values[headerIndexMap["transaction_id"]]?.trim();
    const name = values[headerIndexMap["customer_name"]]?.trim();
    const email = values[headerIndexMap["customer_email"]]?.trim();
    const phone = values[headerIndexMap["customer_phone"]]?.trim();
    const amountStr = values[headerIndexMap["amount"]]?.trim();
    const currency = values[headerIndexMap["currency"]]?.trim() || "INR";
    const statusStr = values[headerIndexMap["status"]]?.trim().toLowerCase();
    const paymentMethod = values[headerIndexMap["payment_method"]]?.trim().toLowerCase() || "card";
    const failureReason = values[headerIndexMap["failure_reason"]]?.trim() || "none";
    const attemptedAt = values[headerIndexMap["attempted_at"]]?.trim() || new Date().toISOString();
    const retryCountStr = values[headerIndexMap["retry_count"]]?.trim() || "0";

    if (!txId) {
      errors.push({ row: rowNum, field: "transaction_id", message: "transaction_id is required." });
      continue;
    }

    if (!name) {
      errors.push({ row: rowNum, field: "customer_name", message: "customer_name is required." });
      continue;
    }

    const amount = Number.parseFloat(amountStr);
    if (Number.isNaN(amount) || amount < 0) {
      errors.push({
        row: rowNum,
        field: "amount",
        value: amountStr,
        message: `Invalid amount '${amountStr}'. Amount must be a positive number.`,
      });
      continue;
    }

    if (!validStatuses.has(statusStr)) {
      errors.push({
        row: rowNum,
        field: "status",
        value: statusStr,
        message: `Invalid status '${statusStr}'. Status must be one of: successful, failed, abandoned, recovered.`,
      });
      continue;
    }

    const retryCount = Number.parseInt(retryCountStr, 10);
    const validRetry = !Number.isNaN(retryCount) && retryCount >= 0 ? retryCount : 0;

    const tx: Transaction = {
      transaction_id: txId,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      amount,
      currency,
      status: statusStr as TransactionStatus,
      payment_method: paymentMethod,
      failure_reason: failureReason,
      attempted_at: attemptedAt,
      retry_count: validRetry,
      action_status: statusStr === "recovered" ? "mark_recovered" : "not_started",
    };

    const intel = deriveTransactionIntelligence(tx);
    transactions.push({ ...tx, ...intel });
  }

  return {
    valid: errors.length === 0,
    transactions,
    errors,
    totalRows: lines.length - 1,
    validRows: transactions.length,
  };
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}
