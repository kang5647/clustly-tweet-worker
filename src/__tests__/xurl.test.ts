import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";

// We need to test the extractTweetId logic and error classification.
// Since extractTweetId is not exported, we test it through postReply/postTweet
// by mocking execFile.

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: unknown) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        (fn as Function)(...args, (err: Error | null, result: unknown) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  },
}));

// Import after mocks
const { postReply, postTweet, checkXurl } = await import("../xurl.js");

const mockExecFile = vi.mocked(execFile);

function mockSuccess(stdout: string, stderr = "") {
  mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
    if (typeof _opts === "function") {
      cb = _opts;
    }
    cb(null, { stdout, stderr });
    return {} as any;
  });
}

function mockError(message: string) {
  mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
    if (typeof _opts === "function") {
      cb = _opts;
    }
    cb(new Error(message), { stdout: "", stderr: "" });
    return {} as any;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("postReply", () => {
  it("extracts tweet ID from x.com URL", async () => {
    mockSuccess("https://x.com/Clustlydotai/status/1234567890123456789");
    const result = await postReply("111", "test");
    expect(result.ok).toBe(true);
    expect(result.tweetId).toBe("1234567890123456789");
  });

  it("extracts tweet ID from twitter.com URL", async () => {
    mockSuccess("https://twitter.com/user/status/9876543210123456789");
    const result = await postReply("111", "test");
    expect(result.ok).toBe(true);
    expect(result.tweetId).toBe("9876543210123456789");
  });

  it("extracts raw numeric ID", async () => {
    mockSuccess("1234567890123456789");
    const result = await postReply("111", "test");
    expect(result.ok).toBe(true);
    expect(result.tweetId).toBe("1234567890123456789");
  });

  it("detects rate limit errors", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === "function") cb = _opts;
      cb(null, { stdout: "", stderr: "429 rate limit exceeded" });
      return {} as any;
    });
    const result = await postReply("111", "test");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("rate_limited");
  });

  it("detects auth failures", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === "function") cb = _opts;
      cb(null, { stdout: "", stderr: "401 auth failed" });
      return {} as any;
    });
    const result = await postReply("111", "test");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("auth_failed");
  });

  it("handles timeout errors", async () => {
    mockError("Command timed out");
    const result = await postReply("111", "test");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });

  it("returns unknown error for unrecognized output", async () => {
    mockExecFile.mockImplementation((_cmd: any, _args: any, _opts: any, cb: any) => {
      if (typeof _opts === "function") cb = _opts;
      cb(null, { stdout: "", stderr: "something weird happened" });
      return {} as any;
    });
    const result = await postReply("111", "test");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("unknown");
  });
});

describe("postTweet", () => {
  it("posts successfully with URL output", async () => {
    mockSuccess("https://x.com/Clustlydotai/status/1111111111111111111");
    const result = await postTweet("hello world");
    expect(result.ok).toBe(true);
    expect(result.tweetId).toBe("1111111111111111111");
  });
});
