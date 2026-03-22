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

function log(level: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const extra = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${ts}] [${level}] ${msg}${extra}`);
}

async function processEntry(entry: QueueEntry): Promise<void> {
  log("info", `Processing entry ${entry.id}`, {
    type: entry.reply_to_tweet_id ? "reply" : "standalone",
    recipient: entry.recipient_handle,
    amount: entry.total_amount,
  });

  await markProcessing(entry.id);

  if (entry.reply_to_tweet_id) {
    // ── Reply to a specific tweet ──
    const text = buildReplyText(entry);
    log("info", `Posting reply to tweet ${entry.reply_to_tweet_id}`, { text });

    const result = await postReply(entry.reply_to_tweet_id, text);

    if (result.ok && result.tweetId) {
      await markSent(entry.id, result.tweetId);
      log("info", `Reply posted successfully`, { tweetId: result.tweetId });
    } else {
      log("warn", `Reply failed`, { error: result.error, output: result.output });
      await markFailed(entry, config.maxAttempts, config.backoffMinutes);
    }
  } else {
    // ── Standalone tweet ──
    const text = buildBatchText([entry]);
    log("info", `Posting standalone tweet`, { text });

    const result = await postTweet(text);

    if (result.ok && result.tweetId) {
      await markSent(entry.id, result.tweetId);
      log("info", `Tweet posted successfully`, { tweetId: result.tweetId });
    } else {
      log("warn", `Tweet failed`, { error: result.error, output: result.output });
      await markFailed(entry, config.maxAttempts, config.backoffMinutes);
    }
  }
}

async function pollOnce(): Promise<void> {
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
    // Allow the timer to not keep the process alive during shutdown
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
