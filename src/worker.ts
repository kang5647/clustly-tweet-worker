/**
 * clustly-tweet-worker
 *
 * Polls the Supabase tweet_notification_queue and posts via xurl.
 * Designed to run 24/7 on a Mac Mini.
 */

import { config } from "./config.js";
import { fetchNextPending, markProcessing, markSent, markFailed } from "./supabase.js";
import { checkXurl, postReply, postTweet } from "./xurl.js";
import { buildReplyText, buildBatchText } from "./templates.js";
import type { QueueEntry } from "./supabase.js";

let running = true;

// ── Circuit breaker ──────────────────────────────────────────────
// Pauses polling when xurl auth fails to avoid burning retries
// on every queued entry.
const CIRCUIT_PAUSE_MS = 30 * 60 * 1000; // 30 minutes

export let circuitOpen = false;
export let circuitOpenUntil = 0;

export function openCircuit(): void {
  circuitOpen = true;
  circuitOpenUntil = Date.now() + CIRCUIT_PAUSE_MS;
  log("error", `Circuit breaker OPEN — pausing polling for 30 min (until ${new Date(circuitOpenUntil).toISOString()})`);
}

export function resetCircuit(): void {
  if (circuitOpen) {
    log("info", "Circuit breaker CLOSED — resuming normal polling");
    circuitOpen = false;
    circuitOpenUntil = 0;
  }
}

// ── Logging ──────────────────────────────────────────────────────

export function log(level: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const extra = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${ts}] [${level}] ${msg}${extra}`);
}

// ── Entry processing ─────────────────────────────────────────────

export async function processEntry(entry: QueueEntry): Promise<void> {
  log("info", `Processing entry ${entry.id}`, {
    type: entry.reply_to_tweet_id ? "reply" : "standalone",
    recipient: entry.recipient_handle,
    amount: entry.total_amount,
  });

  await markProcessing(entry.id);

  let result;
  let text: string;

  if (entry.reply_to_tweet_id) {
    text = buildReplyText(entry);
    log("info", `Posting reply to tweet ${entry.reply_to_tweet_id}`, { text });
    result = await postReply(entry.reply_to_tweet_id, text);
  } else {
    text = buildBatchText([entry]);
    log("info", `Posting standalone tweet`, { text });
    result = await postTweet(text);
  }

  if (result.ok && result.tweetId) {
    await markSent(entry.id, result.tweetId);
    log("info", `Tweet posted successfully`, { tweetId: result.tweetId });
    resetCircuit();
    return;
  }

  // Auth failure → open circuit breaker, leave entry as pending (don't burn retries)
  if (result.error === "auth_failed") {
    openCircuit();
    // Revert to pending so it's not stuck in processing
    await markFailed(
      { ...entry, attempts: entry.attempts - 1 }, // offset so attempts stays the same
      config.maxAttempts,
      config.backoffMinutes,
    );
    return;
  }

  log("warn", `Tweet failed`, { error: result.error, output: result.output });
  await markFailed(entry, config.maxAttempts, config.backoffMinutes);
}

// ── Poll loop ────────────────────────────────────────────────────

export async function pollOnce(): Promise<void> {
  // Circuit breaker check
  if (circuitOpen) {
    if (Date.now() < circuitOpenUntil) {
      return; // still paused
    }
    log("info", "Circuit breaker timeout expired — attempting one probe request...");
  }

  try {
    const entry = await fetchNextPending();
    if (!entry) return;
    await processEntry(entry);
  } catch (err) {
    log("error", `Poll error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  log("info", "=== clustly-tweet-worker starting ===");
  log("info", `Poll interval: ${config.pollIntervalMs}ms`);
  log("info", `Max attempts: ${config.maxAttempts}`);
  log("info", `Backoff: ${config.backoffMinutes} min (exponential)`);

  // Preflight: check xurl
  const { installed, authenticated } = await checkXurl();
  if (!installed) {
    log("error", "xurl is not installed. Run: brew install xurl (or install from source)");
    process.exit(1);
  }
  if (!authenticated) {
    log("warn", "xurl may not be authenticated. Run: xurl auth");
  }
  log("info", "xurl check passed");

  // Main loop
  while (running) {
    await pollOnce();
    await sleep(config.pollIntervalMs);
  }

  log("info", "Worker stopped gracefully");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (timer.unref) timer.unref();
  });
}

// Graceful shutdown
process.on("SIGINT", () => {
  log("info", "Received SIGINT — shutting down...");
  running = false;
});

process.on("SIGTERM", () => {
  log("info", "Received SIGTERM — shutting down...");
  running = false;
});

main().catch((err) => {
  log("error", `Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
