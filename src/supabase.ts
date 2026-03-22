import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export interface QueueEntry {
  id: string;
  recipient_handle: string;
  tip_ids: string[];
  total_amount: number;
  currency: string;
  reply_to_tweet_id: string | null;
  sender_handle: string | null;
  tx_hash: string | null;
  priority: number;
  status: string;
  attempts: number;
  send_after: string;
  created_at: string;
  updated_at: string;
}

const STALE_PROCESSING_MINUTES = 10;

/** Reset entries stuck in 'processing' for too long back to 'pending'. */
export async function recoverStaleProcessing(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("tweet_notification_queue")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) {
    console.warn("[supabase] Failed to recover stale processing entries:", error);
    return 0;
  }

  return data?.length ?? 0;
}

/** Fetch the next pending entry (replies first, then standalones). */
export async function fetchNextPending(): Promise<QueueEntry | null> {
  const now = new Date().toISOString();

  // Priority: replies first (priority=10)
  const { data: reply } = await supabase
    .from("tweet_notification_queue")
    .select("*")
    .eq("status", "pending")
    .not("reply_to_tweet_id", "is", null)
    .lte("send_after", now)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (reply) return reply as QueueEntry;

  // Then standalones
  const { data: standalone } = await supabase
    .from("tweet_notification_queue")
    .select("*")
    .eq("status", "pending")
    .is("reply_to_tweet_id", null)
    .lte("send_after", now)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (standalone as QueueEntry) ?? null;
}

/** Mark entry as processing. */
export async function markProcessing(id: string): Promise<void> {
  await supabase
    .from("tweet_notification_queue")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", id);
}

/** Mark entry as sent with the posted tweet ID. */
export async function markSent(id: string, tweetId: string): Promise<void> {
  await supabase
    .from("tweet_notification_queue")
    .update({
      status: "sent",
      tweet_id: tweetId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

/** Mark entry as failed or schedule retry. */
export async function markFailed(entry: QueueEntry, maxAttempts: number, backoffMinutes: number): Promise<void> {
  const newAttempts = entry.attempts + 1;

  if (newAttempts >= maxAttempts) {
    await supabase
      .from("tweet_notification_queue")
      .update({
        status: "failed",
        attempts: newAttempts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
  } else {
    const nextRetry = new Date(
      Date.now() + backoffMinutes * 60 * 1000 * Math.pow(2, newAttempts - 1)
    ).toISOString();

    await supabase
      .from("tweet_notification_queue")
      .update({
        status: "pending",
        attempts: newAttempts,
        send_after: nextRetry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
  }
}
