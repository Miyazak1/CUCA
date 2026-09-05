import { randomBytes, randomUUID } from "node:crypto";

export const LOCAL_RUNTIME_VERSION = 1;
export const LOCAL_RUNTIME_OWNER = "cuac-local-development-v1";
export const LOCAL_RUNTIME_LABEL = "com.cuac.runtime";
export const LOCAL_INSTALLATION_LABEL = "com.cuac.installation";
export const LOCAL_STATE_RELATIVE_PATH = ".cuac-local/runtime.json";
export const LOCAL_POSTGRES_CONTAINER = "cuac-pg-local";
export const LOCAL_POSTGRES_VOLUME = "cuac-pg-local-data-v1";
export const LOCAL_POSTGRES_IMAGE_TAG = "postgres:16-alpine";
export const LOCAL_POSTGRES_USER = "cuac_local";
export const LOCAL_POSTGRES_DATABASE = "cuac_local";
export const LOCAL_POSTGRES_PORT = 55432;
export const LOCAL_APPLICATION_PORT = 3000;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;
const imagePattern = /^sha256:[a-f0-9]{64}$/;

export type LocalDevelopmentCommand = "up" | "dev" | "status" | "stop" | "credentials";

export type LocalDevelopmentState = {
  version: 1;
  owner: typeof LOCAL_RUNTIME_OWNER;
  installationId: string;
  createdAt: string;
  postgresImageId: string;
  postgresContainer: typeof LOCAL_POSTGRES_CONTAINER;
  postgresVolume: typeof LOCAL_POSTGRES_VOLUME;
  postgresPort: number;
  applicationPort: number;
  databaseUser: typeof LOCAL_POSTGRES_USER;
  databaseName: typeof LOCAL_POSTGRES_DATABASE;
  databasePassword: string;
  sessionSecret: string;
  materialSnapshotKeyId: "local-v1";
  materialSnapshotKey: string;
  studentEmail: string;
  studentPassword: string;
  applicationSetId: string;
  choiceIds: [string, string, string];
};

export function localSyntheticAccounts(state: LocalDevelopmentState) {
  assertLocalDevelopmentState(state);
  const shortId = state.installationId.slice(0, 8);
  return {
    student: { email: state.studentEmail, password: state.studentPassword },
    school: { email: `school+${shortId}@local.cuac.invalid`, password: state.studentPassword },
    ops: { email: `ops+${shortId}@local.cuac.invalid`, password: state.studentPassword },
    admin: { email: `admin+${shortId}@local.cuac.invalid`, password: state.studentPassword },
  } as const;
}

export function isHealthyLocalApplicationStatus(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  if (!status.database || typeof status.database !== "object" || Array.isArray(status.database)) return false;
  return status.service === "cuac-backend" && status.status === "ok"
    && (status.database as Record<string, unknown>).reachable === true;
}

export function parseLocalDevelopmentCommand(args: readonly string[]): LocalDevelopmentCommand {
  if (args.length !== 1 || !["up", "dev", "status", "stop", "credentials"].includes(args[0] ?? "")) {
    throw new Error("Use one local development command: up, dev, status, stop, or credentials.");
  }
  return args[0] as LocalDevelopmentCommand;
}

export function resolveLocalPort(value: string | undefined, fallback: number, label: string): number {
  const raw = value?.trim() || String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${label} must be an integer port.`);
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${label} must be between 1024 and 65535.`);
  }
  return port;
}

export function createLocalDevelopmentState(input: {
  postgresImageId: string;
  postgresPort?: number;
  applicationPort?: number;
  now?: Date;
  bytes?: (size: number) => Buffer;
  uuid?: () => string;
}): LocalDevelopmentState {
  if (!imagePattern.test(input.postgresImageId)) throw new Error("Local PostgreSQL image must be pinned by image ID.");
  const bytes = input.bytes ?? randomBytes;
  const uuid = input.uuid ?? randomUUID;
  const installationId = uuid();
  const shortId = installationId.slice(0, 8);
  const state: LocalDevelopmentState = {
    version: LOCAL_RUNTIME_VERSION,
    owner: LOCAL_RUNTIME_OWNER,
    installationId,
    createdAt: (input.now ?? new Date()).toISOString(),
    postgresImageId: input.postgresImageId,
    postgresContainer: LOCAL_POSTGRES_CONTAINER,
    postgresVolume: LOCAL_POSTGRES_VOLUME,
    postgresPort: input.postgresPort ?? LOCAL_POSTGRES_PORT,
    applicationPort: input.applicationPort ?? LOCAL_APPLICATION_PORT,
    databaseUser: LOCAL_POSTGRES_USER,
    databaseName: LOCAL_POSTGRES_DATABASE,
    databasePassword: bytes(32).toString("base64url"),
    sessionSecret: bytes(32).toString("base64url"),
    materialSnapshotKeyId: "local-v1",
    materialSnapshotKey: bytes(32).toString("base64url"),
    studentEmail: `student+${shortId}@local.cuac.invalid`,
    studentPassword: bytes(32).toString("base64url"),
    applicationSetId: uuid(),
    choiceIds: [uuid(), uuid(), uuid()],
  };
  assertLocalDevelopmentState(state);
  return state;
}

export function assertLocalDevelopmentState(value: unknown): asserts value is LocalDevelopmentState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Local runtime state is invalid.");
  const state = value as Record<string, unknown>;
  const expectedKeys = [
    "version", "owner", "installationId", "createdAt", "postgresImageId", "postgresContainer", "postgresVolume",
    "postgresPort", "applicationPort", "databaseUser", "databaseName", "databasePassword", "sessionSecret",
    "materialSnapshotKeyId", "materialSnapshotKey", "studentEmail", "studentPassword", "applicationSetId", "choiceIds",
  ];
  if (Object.keys(state).sort().join("\n") !== [...expectedKeys].sort().join("\n")) throw new Error("Local runtime state shape is invalid.");
  if (state.version !== LOCAL_RUNTIME_VERSION || state.owner !== LOCAL_RUNTIME_OWNER
    || state.postgresContainer !== LOCAL_POSTGRES_CONTAINER || state.postgresVolume !== LOCAL_POSTGRES_VOLUME
    || state.databaseUser !== LOCAL_POSTGRES_USER || state.databaseName !== LOCAL_POSTGRES_DATABASE
    || state.materialSnapshotKeyId !== "local-v1") throw new Error("Local runtime identity is invalid.");
  if (typeof state.installationId !== "string" || !uuidPattern.test(state.installationId)
    || typeof state.applicationSetId !== "string" || !uuidPattern.test(state.applicationSetId)) throw new Error("Local runtime UUIDs are invalid.");
  if (typeof state.createdAt !== "string" || !Number.isFinite(Date.parse(state.createdAt))) throw new Error("Local runtime creation time is invalid.");
  if (typeof state.postgresImageId !== "string" || !imagePattern.test(state.postgresImageId)) throw new Error("Local PostgreSQL image ID is invalid.");
  if (typeof state.postgresPort !== "number" || typeof state.applicationPort !== "number") throw new Error("Local runtime ports are invalid.");
  resolveLocalPort(String(state.postgresPort), LOCAL_POSTGRES_PORT, "Local PostgreSQL port");
  resolveLocalPort(String(state.applicationPort), LOCAL_APPLICATION_PORT, "Local application port");
  for (const field of ["databasePassword", "sessionSecret", "materialSnapshotKey", "studentPassword"] as const) {
    if (typeof state[field] !== "string" || !secretPattern.test(state[field])) throw new Error(`Local runtime ${field} is invalid.`);
  }
  const expectedEmail = `student+${state.installationId.slice(0, 8)}@local.cuac.invalid`;
  if (state.studentEmail !== expectedEmail) throw new Error("Local synthetic account identity is invalid.");
  if (!Array.isArray(state.choiceIds) || state.choiceIds.length !== 3
    || state.choiceIds.some(id => typeof id !== "string" || !uuidPattern.test(id))
    || new Set(state.choiceIds).size !== 3) throw new Error("Local application choice IDs are invalid.");
}

export function localDatabaseUrl(state: LocalDevelopmentState): string {
  assertLocalDevelopmentState(state);
  const url = new URL("postgresql://127.0.0.1");
  url.username = state.databaseUser;
  url.password = state.databasePassword;
  url.port = String(state.postgresPort);
  url.pathname = `/${state.databaseName}`;
  return url.toString();
}

export function assertLocalDatabaseTarget(databaseUrl: string, state: LocalDevelopmentState): void {
  if (databaseUrl !== localDatabaseUrl(state)) throw new Error("Local runtime refuses a database target outside its generated loopback PostgreSQL instance.");
}

export function localRuntimeEnvironment(state: LocalDevelopmentState, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const accounts = localSyntheticAccounts(state);
  const env: NodeJS.ProcessEnv = { ...base };
  for (const key of [
    "POSTGRES_URL", "PG_DATABASE_URL", "CUAC_ALLOW_PRODUCTION_MIGRATION", "CUAC_MIGRATION_RUNBOOK_ACK",
    "CUAC_PAYMENT_PROVIDER", "CUAC_PAYMENT_GATEWAY_ENDPOINT", "CUAC_PAYMENT_GATEWAY_ALLOWED_HOST",
    "CUAC_PAYMENT_CHECKOUT_ALLOWED_HOST", "CUAC_PAYMENT_GATEWAY_HMAC_SECRET", "CUAC_PAYMENT_WEBHOOK_SECRET",
    "CUAC_PAYMENT_GATEWAY_TIMEOUT_MS", "CUAC_PAYMENT_WEBHOOK_MAX_SKEW_MS",
    "CUAC_PAYMENT_RECONCILIATION_POLL_MS", "CUAC_PAYMENT_RECONCILIATION_WORKER_SUPERVISED",
    "CUAC_PAYMENT_STAGING_ACCEPTED", "ALIBABA_CLOUD_REGION", "ALIYUN_REGION",
    "ALIBABA_CLOUD_KMS_KEY_ID", "ALIYUN_KMS_KEY_ID", "CUAC_SECRET_MANAGER",
    "CUAC_AGENT_ENABLED", "CUAC_AGENT_TOOL_GATEWAY_MODE", "CUAC_AGENT_SANDBOX_MODE", "CUAC_AGENT_DIRECT_DB_ACCESS",
  ]) delete env[key];
  Object.assign(env, {
    NODE_ENV: "development",
    CUAC_ENV: "development",
    DEPLOY_ENV: "development",
    CUAC_LOCAL_RUNTIME: "1",
    CUAC_LOCAL_INSTALLATION_ID: state.installationId,
    CUAC_MIGRATION_TARGET_ENV: "development",
    DATABASE_URL: localDatabaseUrl(state),
    PGSSLMODE: "disable",
    PORT: String(state.applicationPort),
    CUAC_HTTP_HOST: "127.0.0.1",
    CUAC_PUBLIC_APP_URL: `http://127.0.0.1:${state.applicationPort}`,
    CUAC_REQUIRE_PRODUCTION_READY: "false",
    CUAC_SESSION_SECRET: state.sessionSecret,
    CUAC_AUTH_RATE_LIMIT_ENFORCED: "true",
    CUAC_AUTH_RATE_LIMIT_BACKEND: "postgres",
    CUAC_AUTH_EMAIL_DELIVERY_PROVIDER: "disabled",
    CUAC_AGENT_ENABLED: "false",
    CUAC_AGENT_TOOL_GATEWAY_MODE: "disabled",
    CUAC_AGENT_SANDBOX_MODE: "disabled",
    CUAC_AGENT_DIRECT_DB_ACCESS: "false",
    CUAC_PAYMENT_MODE: "disabled",
    CUAC_FILE_UPLOAD_ENABLED: "false",
    CUAC_APPLICATION_FEE_MINOR: "80000",
    CUAC_SERVICE_FEE_MINOR: "0",
    CUAC_BILLING_CURRENCY: "CNY",
    CUAC_MATERIAL_SNAPSHOT_ACTIVE_KEY_ID: state.materialSnapshotKeyId,
    CUAC_MATERIAL_SNAPSHOT_KEYRING_JSON: JSON.stringify({ [state.materialSnapshotKeyId]: state.materialSnapshotKey }),
    CUAC_LOCAL_STUDENT_EMAIL: state.studentEmail,
    CUAC_LOCAL_STUDENT_PASSWORD: state.studentPassword,
    CUAC_LOCAL_SCHOOL_EMAIL: accounts.school.email,
    CUAC_LOCAL_SCHOOL_PASSWORD: accounts.school.password,
    CUAC_LOCAL_OPS_EMAIL: accounts.ops.email,
    CUAC_LOCAL_OPS_PASSWORD: accounts.ops.password,
    CUAC_LOCAL_ADMIN_EMAIL: accounts.admin.email,
    CUAC_LOCAL_ADMIN_PASSWORD: accounts.admin.password,
    CUAC_LOCAL_APPLICATION_SET_ID: state.applicationSetId,
    CUAC_LOCAL_CHOICE_IDS_JSON: JSON.stringify(state.choiceIds),
  });
  return env;
}

export function postgresDockerRunArgs(state: LocalDevelopmentState): string[] {
  assertLocalDevelopmentState(state);
  return [
    "run", "--detach", "--name", state.postgresContainer,
    "--label", `${LOCAL_RUNTIME_LABEL}=${LOCAL_RUNTIME_OWNER}`,
    "--label", `${LOCAL_INSTALLATION_LABEL}=${state.installationId}`,
    "--publish", `127.0.0.1:${state.postgresPort}:5432`,
    "--mount", `type=volume,source=${state.postgresVolume},target=/var/lib/postgresql/data`,
    "--health-cmd", `pg_isready -U ${state.databaseUser} -d ${state.databaseName}`,
    "--health-interval", "2s", "--health-timeout", "2s", "--health-retries", "20",
    "--env", "POSTGRES_PASSWORD",
    "--env", `POSTGRES_USER=${state.databaseUser}`,
    "--env", `POSTGRES_DB=${state.databaseName}`,
    state.postgresImageId,
  ];
}

export function assertLoopbackPostgresBinding(binding: string, state: LocalDevelopmentState): void {
  if (binding.trim() !== `127.0.0.1:${state.postgresPort}`) {
    throw new Error("Local PostgreSQL must publish exactly one IPv4 loopback binding.");
  }
}
