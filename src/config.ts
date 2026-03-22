import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_KEY"),
  xBearerToken: required("X_BEARER_TOKEN"),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || "30000"),
  maxAttempts: Number(process.env.MAX_ATTEMPTS || "3"),
  backoffMinutes: Number(process.env.BACKOFF_MINUTES || "5"),
  logLevel: process.env.LOG_LEVEL || "info",
} as const;
