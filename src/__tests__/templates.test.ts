import { describe, it, expect } from "vitest";
import { buildReplyText, buildBatchText } from "../templates.js";
import type { QueueEntry } from "../supabase.js";

function makeEntry(overrides: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: "test-id",
    recipient_handle: "alice",
    tip_ids: ["tip-1"],
    total_amount: 5.0,
    currency: "USDC",
    reply_to_tweet_id: "12345",
    sender_handle: "bob",
    tx_hash: "0xabc123",
    priority: 10,
    status: "pending",
    attempts: 0,
    send_after: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildReplyText", () => {
  it("includes sender handle when present", () => {
    const text = buildReplyText(makeEntry({ sender_handle: "bob" }));
    expect(text).toContain("@bob tipped @alice");
  });

  it("uses 'Someone' when no sender handle", () => {
    const text = buildReplyText(makeEntry({ sender_handle: null }));
    expect(text).toContain("Someone tipped @alice");
  });

  it("includes tx link when tx_hash is present", () => {
    const text = buildReplyText(makeEntry({ tx_hash: "0xdeadbeef" }));
    expect(text).toContain("https://basescan.org/tx/0xdeadbeef");
  });

  it("omits tx link when no tx_hash", () => {
    const text = buildReplyText(makeEntry({ tx_hash: null }));
    expect(text).not.toContain("basescan.org");
  });

  it("formats amount to 2 decimal places", () => {
    const text = buildReplyText(makeEntry({ total_amount: 5 }));
    expect(text).toContain("5.00 USDC");
  });

  it("includes @Clustlydotai mention", () => {
    const text = buildReplyText(makeEntry());
    expect(text).toContain("@Clustlydotai");
  });
});

describe("buildBatchText", () => {
  it("includes header and footer", () => {
    const text = buildBatchText([makeEntry()]);
    expect(text).toContain("Tips sent via @Clustlydotai!");
    expect(text).toContain("https://clustly.ai");
  });

  it("includes recipient and amount", () => {
    const text = buildBatchText([makeEntry({ recipient_handle: "charlie", total_amount: 10.99 })]);
    expect(text).toContain("@charlie — 10 USDC");
  });

  it("truncates entries to fit within 280 chars", () => {
    const entries = Array.from({ length: 50 }, (_, i) =>
      makeEntry({ recipient_handle: `user_with_a_very_long_handle_${i}`, total_amount: 100 })
    );
    const text = buildBatchText(entries);
    expect(text.length).toBeLessThanOrEqual(280);
  });
});
