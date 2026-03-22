/**
 * xurl subprocess wrapper — inspired by birdclaw's transport adapter pattern.
 * Shells out to `xurl` CLI for cookie-based X posting (no API keys needed).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const XURL_TIMEOUT_MS = 30_000;

export interface XurlResult {
  ok: boolean;
  tweetId?: string;
  output: string;
  error?: string;
}

/** Check if xurl is installed and authenticated. */
export async function checkXurl(): Promise<{ installed: boolean; authenticated: boolean }> {
  try {
    await execFileAsync("which", ["xurl"]);
  } catch {
    return { installed: false, authenticated: false };
  }

  try {
    const { stdout } = await execFileAsync("xurl", ["whoami"], {
      timeout: XURL_TIMEOUT_MS,
    });
    const authenticated = stdout.trim().length > 0 && !stdout.includes("error");
    return { installed: true, authenticated };
  } catch {
    return { installed: true, authenticated: false };
  }
}

/** Post a reply to a tweet. */
export async function postReply(tweetId: string, text: string): Promise<XurlResult> {
  return runXurl(["reply", tweetId, text]);
}

/** Post a standalone tweet. */
export async function postTweet(text: string): Promise<XurlResult> {
  return runXurl(["post", text]);
}

/** Run an xurl command and parse the result. */
async function runXurl(args: string[]): Promise<XurlResult> {
  try {
    const { stdout, stderr } = await execFileAsync("xurl", args, {
      timeout: XURL_TIMEOUT_MS,
      env: { ...process.env },
    });

    const output = stdout.trim();
    const errorOutput = stderr.trim();

    // xurl typically outputs the tweet URL or ID on success
    const tweetId = extractTweetId(output);

    if (tweetId) {
      return { ok: true, tweetId, output };
    }

    // Check for known error patterns
    if (errorOutput.includes("rate limit") || errorOutput.includes("429")) {
      return { ok: false, output, error: "rate_limited" };
    }

    if (errorOutput.includes("auth") || errorOutput.includes("401") || errorOutput.includes("403")) {
      return { ok: false, output, error: "auth_failed" };
    }

    // If we got output but couldn't parse a tweet ID, still consider it success
    // (xurl output format may vary)
    if (output.length > 0 && !errorOutput) {
      return { ok: true, output, tweetId: output };
    }

    return { ok: false, output: output || errorOutput, error: "unknown" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("ETIMEDOUT") || message.includes("timed out")) {
      return { ok: false, output: "", error: "timeout" };
    }

    return { ok: false, output: "", error: message };
  }
}

/** Extract tweet ID from xurl output (URL or raw ID). */
function extractTweetId(output: string): string | undefined {
  // Match twitter/x.com status URL
  const urlMatch = output.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (urlMatch) return urlMatch[1];

  // Match raw numeric ID
  const idMatch = output.match(/^(\d{10,})$/m);
  if (idMatch) return idMatch[1];

  return undefined;
}
