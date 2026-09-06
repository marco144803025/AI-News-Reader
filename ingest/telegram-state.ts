export class DeliveryError extends Error {}
export class StateConflict extends DeliveryError {}

export type AttemptStatus = "pending" | "sent" | "uncertain" | "failed" | "released";
export type Attempt = {
  id: string;
  date: string;
  briefId: string;
  status: AttemptStatus;
  updatedAt: string;
};
export type DeliveryState = { version: 1; attempts: Attempt[] };
export type StateSnapshot = { state: DeliveryState; sha: string | null };
export interface StateStore {
  read(): Promise<StateSnapshot>;
  save(previous: StateSnapshot, state: DeliveryState): Promise<StateSnapshot>;
}
export const STATE_PATH = ".delivery/telegram.json";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace(/(?<!\.\d{3})Z$/, ".000Z");
}

/** Fail closed on corrupt or unfamiliar state; never silently recreate it. */
export function parseState(value: unknown): DeliveryState {
  const invalid = () => new DeliveryError("Telegram state is invalid. Inspect the repository state file before recovery.");
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.attempts) ||
      Object.keys(value).some(key => !["version", "attempts"].includes(key))) throw invalid();
  const ids = new Set<string>();
  const statuses = ["pending", "sent", "uncertain", "failed", "released"];
  const attempts: Attempt[] = value.attempts.map(item => {
    if (!isRecord(item) || Object.keys(item).sort().join() !== "briefId,date,id,status,updatedAt" ||
        typeof item.id !== "string" || !/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id) ||
        typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
        !isUtcTimestamp(item.date + "T00:00:00Z") ||
        typeof item.briefId !== "string" || !/^[a-f0-9]{64}$/.test(item.briefId) ||
        typeof item.status !== "string" || !statuses.includes(item.status) ||
        !isUtcTimestamp(item.updatedAt)) throw invalid();
    ids.add(item.id);
    return { id: item.id, date: item.date, briefId: item.briefId,
      status: item.status as AttemptStatus, updatedAt: item.updatedAt };
  });
  return { version: 1, attempts };
}

/** GitHub's required current blob SHA acts as a compare-and-swap reservation. */
export class GitHubStateStore implements StateStore {
  private readonly url: string;
  constructor(
    repository: string,
    private readonly token: string,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      throw new DeliveryError("Set GITHUB_REPOSITORY to owner/repository.");
    }
    if (!token.trim()) throw new DeliveryError("Set GITHUB_TOKEN with Contents read/write access for delivery state.");
    this.url = `https://api.github.com/repos/${repository}/contents/${STATE_PATH}`;
  }

  private async request(method: string, body?: unknown): Promise<Response> {
    try {
      return await this.transport(this.url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new DeliveryError("GitHub delivery-state request failed. No blind retry; inspect state before sending again.");
    }
  }

  private async json(response: Response): Promise<Record<string, unknown>> {
    try {
      const value: unknown = await response.json();
      if (isRecord(value)) return value;
    } catch { /* Only a locally authored error may be printed. */ }
    throw new DeliveryError("GitHub returned invalid delivery-state data. Inspect state before retrying.");
  }

  async read(): Promise<StateSnapshot> {
    const response = await this.request("GET");
    if (response.status === 404) return { sha: null, state: { version: 1, attempts: [] } };
    if (!response.ok) throw new DeliveryError("Cannot read Telegram state. Check GitHub token, repository, and permissions.");
    const value = await this.json(response);
    if (value.type !== "file" || value.encoding !== "base64" ||
        typeof value.sha !== "string" || !/^[a-f0-9]{40,64}$/.test(value.sha) ||
        typeof value.content !== "string") throw new DeliveryError("Unexpected GitHub state-file format.");
    let raw: unknown;
    try { raw = JSON.parse(Buffer.from(value.content, "base64").toString("utf8")); }
    catch { throw new DeliveryError("Telegram state is not valid JSON. Restore or inspect it before sending."); }
    return { sha: value.sha, state: parseState(raw) };
  }

  async save(previous: StateSnapshot, state: DeliveryState): Promise<StateSnapshot> {
    const checked = parseState(state);
    const text = JSON.stringify(checked, null, 2) + "\n";
    if (Buffer.byteLength(text) > 800_000) throw new DeliveryError("Telegram state is too large. Archive it deliberately before sending.");
    const response = await this.request("PUT", {
      message: "chore: record Telegram delivery state",
      content: Buffer.from(text).toString("base64"),
      ...(previous.sha ? { sha: previous.sha } : {}),
    });
    if (response.status === 409 || response.status === 422) {
      throw new StateConflict("Telegram state changed or its write was rejected. Inspect state before retrying.");
    }
    if (!response.ok) throw new DeliveryError("Cannot persist Telegram state. Check Contents write access and branch protection.");
    const value = await this.json(response);
    if (!isRecord(value.content) || typeof value.content.sha !== "string" ||
        !/^[a-f0-9]{40,64}$/.test(value.content.sha)) {
      throw new DeliveryError("GitHub state write outcome is uncertain. Inspect state before retrying.");
    }
    return { state: checked, sha: value.content.sha };
  }
}
