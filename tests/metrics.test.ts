import { test } from "node:test";
import assert from "node:assert/strict";
import {
  growth,
  score,
  engagement,
  confidence,
  velocity,
} from "../lib/metrics";
import { budgetAllows } from "../lib/ai/budget-rules";
import { encrypt, decrypt, equal } from "../lib/security";
test("missing data is not converted to zero", () => {
  assert.equal(engagement({ likes: null, comments: 2, audience: 10 }), null);
  assert.equal(engagement({ likes: 0, comments: 0, audience: 10 }), 0);
  assert.equal(engagement({ likes: 2, comments: 3, audience: 0 }), null);
  assert.equal(score({}, Array(8).fill({ likes: 10 })), null);
});
test("score requires comparable history and handles ties", () => {
  assert.equal(score({ likes: 10 }, Array(4).fill({ likes: 1 })), null);
  assert.equal(score({ likes: 10 }, Array(5).fill({ likes: 1 })), 100);
  assert.equal(score({ likes: 10 }, Array(5).fill({ likes: 10 })), 50);
  assert.equal(score({ likes: 0 }, Array(5).fill({ likes: 10 })), 0);
});
test("growth requires genuine baseline, stale series rejected", () => {
  const now = new Date("2026-09-09T12:00:00Z");
  assert.equal(growth([{ followers: 100, capturedAt: now }], 30, now), null);
  assert.deepEqual(
    growth(
      [
        { followers: 100, capturedAt: "2026-08-10T12:00:00Z" },
        { followers: 125, capturedAt: now },
      ],
      30,
      now,
    )?.absolute,
    25,
  );
  assert.equal(
    growth(
      [
        { followers: 10, capturedAt: "2025-01-01" },
        { followers: 15, capturedAt: now },
      ],
      30,
      now,
    ),
    null,
  );
});
test("confidence and velocity remain data constrained", () => {
  assert.equal(confidence([]), "BAIXA");
  assert.equal(
    velocity(
      { views: null, capturedAt: "2026-01-01" },
      { views: 10, capturedAt: "2026-01-02" },
    ),
    null,
  );
  assert.equal(
    velocity(
      { views: 24, capturedAt: "2026-01-01" },
      { views: 72, capturedAt: "2026-01-02" },
    ),
    2,
  );
});
test("budget includes outstanding reservations and failed calls", () => {
  const now = new Date("2026-09-09T12:00:00Z"),
    limits = {
      dailyUSD: 2,
      monthlyUSD: 30,
      dailyRequests: 10,
      monthlyRequests: 100,
    };
  assert.equal(
    budgetAllows(
      limits,
      [{ timestamp: now, estimatedCost: null, reservedCost: 1.9 }],
      0.2,
      now,
    ),
    false,
  );
  assert.equal(
    budgetAllows(
      limits,
      [{ timestamp: now, estimatedCost: 1, reservedCost: 1.9 }],
      0.5,
      now,
    ),
    true,
  );
  assert.equal(
    budgetAllows({ ...limits, dailyRequests: 0 }, [], 0, now),
    false,
  );
  assert.equal(budgetAllows({ ...limits, monthlyUSD: 0 }, [], 0.1, now), false);
});
test("tokens roundtrip securely and tampering fails", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  const cipher = encrypt("test-only-token");
  assert.ok(!cipher.includes("test-only-token"));
  assert.equal(decrypt(cipher), "test-only-token");
  const parts = cipher.split(".");
  parts[2] = "00".repeat(16);
  assert.throws(() => decrypt(parts.join(".")));
  assert.equal(equal("same", "same"), true);
  assert.equal(equal("same", "other"), false);
});
