export type D1Result<T> = {
  results?: T[];
  success?: boolean;
  meta?: Record<string, unknown>;
};

export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result<unknown>>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result<unknown>[]>;
};

type CloudflareQueryResult<T> = D1Result<T> & {
  error?: string;
};

type CloudflareEnvelope<T> = {
  success: boolean;
  result?: CloudflareQueryResult<T> | CloudflareQueryResult<T>[];
  errors?: Array<{ code?: number; message?: string }>;
};

type D1Credentials = {
  accountId: string;
  databaseId: string;
  apiToken: string;
};

function credentials(): D1Credentials | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN?.trim();
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

function errorMessage(envelope: CloudflareEnvelope<unknown>) {
  return envelope.errors?.map((error) => error.message).filter(Boolean).join("; ") || "Cloudflare D1 query failed";
}

async function execute<T>(config: D1Credentials, sql: string, params: unknown[]): Promise<D1Result<T>> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/d1/database/${encodeURIComponent(config.databaseId)}/query`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  const envelope = await response.json().catch(() => null) as CloudflareEnvelope<T> | null;
  if (!response.ok || !envelope?.success) {
    throw new Error(envelope ? errorMessage(envelope) : `Cloudflare D1 returned HTTP ${response.status}`);
  }

  const result = Array.isArray(envelope.result) ? envelope.result[0] : envelope.result;
  if (!result?.success) throw new Error(result?.error || "Cloudflare D1 query failed");
  return { results: result.results ?? [], success: true, meta: result.meta };
}

class HttpD1Statement implements D1Statement {
  readonly sql: string;
  readonly values: unknown[];
  private readonly config: D1Credentials;

  constructor(config: D1Credentials, sql: string, values: unknown[] = []) {
    this.config = config;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: unknown[]) {
    return new HttpD1Statement(this.config, this.sql, values);
  }

  all<T>() {
    return execute<T>(this.config, this.sql, this.values);
  }

  async first<T>() {
    const result = await this.all<T>();
    return result.results?.[0] ?? null;
  }

  run() {
    return execute<unknown>(this.config, this.sql, this.values);
  }
}

class HttpD1Database implements D1DatabaseLike {
  private readonly config: D1Credentials;

  constructor(config: D1Credentials) {
    this.config = config;
  }

  prepare(query: string) {
    return new HttpD1Statement(this.config, query);
  }

  async batch(statements: D1Statement[]) {
    const results: D1Result<unknown>[] = [];
    for (const statement of statements) {
      if (!(statement instanceof HttpD1Statement)) throw new Error("Unsupported D1 statement implementation");
      results.push(await execute<unknown>(this.config, statement.sql, statement.values));
    }
    return results;
  }
}

let cachedDatabase: D1DatabaseLike | null | undefined;

export function getD1Database(): D1DatabaseLike | null {
  if (cachedDatabase !== undefined) return cachedDatabase;
  const config = credentials();
  cachedDatabase = config ? new HttpD1Database(config) : null;
  return cachedDatabase;
}

export function hasD1Configuration() {
  return credentials() !== null;
}
