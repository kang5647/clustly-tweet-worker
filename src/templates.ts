/**
 * Tweet text builders — mirrors the templates in the Vercel cron route.
 */

import type { QueueEntry } from "./supabase.js";

/**
 * Explorer URL for a tx hash. The queue doesn't carry a chain column, but the
 * hash format is unambiguous: EVM (Base) tx hashes are 0x + 64 hex chars,
 * Solana signatures are base58 and never start with 0x.
 */
export function explorerTxUrl(txHash: string): string {
  return txHash.startsWith("0x")
    ? `https://basescan.org/tx/${txHash}`
    : `https://solscan.io/tx/${txHash}`;
}

/** Build reply text for a tip notification on a specific tweet. */
export function buildReplyText(entry: QueueEntry): string {
  const sender = entry.sender_handle ? `@${entry.sender_handle}` : "Someone";
  const amount = Number(entry.total_amount).toFixed(2);
  const txLink = entry.tx_hash
    ? `\n\nView tx: ${explorerTxUrl(entry.tx_hash)}`
    : "";

  return `⚡ ${sender} tipped @${entry.recipient_handle} ${amount} ${entry.currency} via @Clustlydotai!${txLink}`;
}

/** Build standalone tweet text for a batch of tip notifications. */
export function buildBatchText(entries: QueueEntry[]): string {
  const CHAR_LIMIT = 280;
  const header = "⚡ Tips sent via @Clustlydotai!\n\n";
  const footer = "\n\nClaim now: https://clustly.ai";
  const available = CHAR_LIMIT - header.length - footer.length;

  let lines = "";
  for (const entry of entries) {
    const amount = Math.floor(Number(entry.total_amount));
    const line = `@${entry.recipient_handle} — ${amount} ${entry.currency}\n`;
    if (lines.length + line.length > available) break;
    lines += line;
  }

  return header + lines.trimEnd() + footer;
}
