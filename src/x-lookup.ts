/**
 * X API v2 lookup — resolves a user's latest tweet.
 * Used when a queue entry has no reply_to_tweet_id so the worker
 * can auto-reply to the recipient's most recent post.
 */

import { config } from "./config.js";

interface LatestTweet {
  id: string;
  text: string;
  created_at?: string;
}

/**
 * Fetch the latest tweet from a user by their X handle.
 * Returns null if the user doesn't exist, has no tweets, or API fails.
 */
export async function fetchLatestTweet(handle: string): Promise<LatestTweet | null> {
  try {
    // Step 1: resolve handle → user ID
    const userRes = await fetch(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`,
      { headers: { Authorization: `Bearer ${config.xBearerToken}` } },
    );

    if (!userRes.ok) {
      console.warn(`[x-lookup] User lookup failed (${userRes.status}) for @${handle}`);
      return null;
    }

    const userData = (await userRes.json()) as { data?: { id: string } };
    if (!userData.data) return null;

    // Step 2: fetch latest tweet
    const tweetsRes = await fetch(
      `https://api.x.com/2/users/${userData.data.id}/tweets?max_results=5&tweet.fields=created_at,text`,
      { headers: { Authorization: `Bearer ${config.xBearerToken}` } },
    );

    if (!tweetsRes.ok) {
      console.warn(`[x-lookup] Tweets fetch failed (${tweetsRes.status}) for @${handle}`);
      return null;
    }

    const tweetsData = (await tweetsRes.json()) as {
      data?: { id: string; text: string; created_at?: string }[];
    };

    if (!tweetsData.data || tweetsData.data.length === 0) return null;

    return tweetsData.data[0];
  } catch (err) {
    console.warn(`[x-lookup] Error looking up @${handle}:`, err);
    return null;
  }
}
