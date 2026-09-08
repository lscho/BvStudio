import assert from "node:assert/strict";
import test from "node:test";
import { importCards } from "./import-license-cards.mjs";

function makeCards(count) {
  return Array.from({ length: count }, (_, index) => ({
    cardKey: `VIP-AAAA-BBBB-CCCC-${String(index).padStart(4, "0")}`,
    kvKey: `card:hash${index}`,
    kvValue: { status: "unused", plan: "lifetime", days: null, maskedKey: "VIP-****0000", hash: `hash${index}`, issuedAt: 1 }
  }));
}

test("writes every card into the target namespace with compact JSON values", async () => {
  const cards = makeCards(5);
  const written = [];
  const failures = await importCards({
    cards,
    namespace: "bvideo-license",
    concurrency: 3,
    putKv: async (key, value, namespace) => {
      written.push({ key, value, namespace });
    }
  });

  assert.equal(failures.length, 0);
  assert.equal(written.length, 5);
  assert.equal(written[0].namespace, "bvideo-license");
  assert.equal(written[0].key, "card:hash0");
  assert.deepEqual(JSON.parse(written[0].value), cards[0].kvValue);
});

test("retries throttled writes with backoff and eventually succeeds", async () => {
  const cards = makeCards(1);
  let attempts = 0;
  const retries = [];
  const failures = await importCards({
    cards,
    namespace: "ns",
    putKv: async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("Throttling.Api: code: 400, Request was denied due to user flow control");
    },
    onRetry: (cardKey, attempt) => retries.push({ cardKey, attempt })
  });

  assert.equal(attempts, 3);
  assert.equal(failures.length, 0);
  assert.deepEqual(retries.map((r) => r.attempt), [1, 2]);
});

test("gives up after exhausting retries and reports the throttle failure", async () => {
  const cards = makeCards(1);
  let attempts = 0;
  const failures = await importCards({
    cards,
    namespace: "ns",
    putKv: async () => {
      attempts += 1;
      throw new Error("Throttling.Api: Request was denied due to user flow control");
    }
  });

  assert.equal(attempts, 6); // 首次 + 5 次退避重试
  assert.equal(failures.length, 1);
  assert.match(failures[0].error, /Throttling/);
});

test("does not retry non-throttle errors", async () => {
  let attempts = 0;
  const failures = await importCards({
    cards: makeCards(1),
    namespace: "ns",
    putKv: async () => {
      attempts += 1;
      throw new Error("InvalidNamespace: not found");
    }
  });

  assert.equal(attempts, 1);
  assert.equal(failures.length, 1);
});

test("collects failures without aborting the remaining writes", async () => {
  const cards = makeCards(4);
  const written = [];
  const failures = await importCards({
    cards,
    namespace: "ns",
    concurrency: 4,
    putKv: async (key, value) => {
      if (key === "card:hash1" || key === "card:hash3") throw new Error("boom");
      written.push(key);
    }
  });

  assert.equal(written.length, 2);
  assert.deepEqual(failures.map((f) => f.cardKey), [cards[1].cardKey, cards[3].cardKey]);
  assert.match(failures[0].error, /boom/);
});

test("handles empty card lists", async () => {
  const failures = await importCards({ cards: [], namespace: "ns", putKv: async () => { throw new Error("should not be called"); } });
  assert.equal(failures.length, 0);
});
