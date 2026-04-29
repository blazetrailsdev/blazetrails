/**
 * Process adapter — routes `process.*` operations through a swappable
 * adapter so trailties and other packages can run under non-Node hosts
 * (browser, sandboxed test envs).
 *
 * The exported `env` and `argv` are populated by copying the registered
 * adapter's snapshot at registration time. They are typed as readonly to
 * prevent compile-time mutation; runtime mutation outside `setEnv` is
 * unsupported and may diverge from the adapter's view.
 *
 * Streams (`stdout`, `stderr`, `stdin`) delegate to the registered
 * adapter at call time so a swap takes effect immediately.
 */

export interface WriteStream {
  write(chunk: string): boolean;
  readonly isTTY: boolean;
  readonly columns?: number;
  readonly rows?: number;
}

export interface ReadStream {
  readonly isTTY: boolean;
  read(): Promise<string | null>;
}

export type SignalName = "SIGINT" | "SIGTERM";

export interface ProcessAdapter {
  envSnapshot(): Record<string, string | undefined>;
  argvSnapshot(): readonly string[];
  cwd(): string;
  chdir(dir: string): void;
  platform(): string;
  setEnv(key: string, value: string | undefined): void;
  exit(code?: number): never;
  setExitCode(code: number): void;
  onSignal(name: SignalName, handler: () => void): () => void;
  readonly stdout: WriteStream;
  readonly stderr: WriteStream;
  readonly stdin: ReadStream;
}

const envInternal: Record<string, string | undefined> = {};
const argvInternal: string[] = [];

export const env = envInternal as Readonly<Record<string, string | undefined>>;
export const argv = argvInternal as ReadonlyArray<string>;

let currentAdapter: ProcessAdapter | null = null;

function requireAdapter(): ProcessAdapter {
  if (!currentAdapter && !tryAutoRegisterNode()) {
    throw new Error(
      "No process adapter configured. Call registerProcessAdapter() or run in a Node host.",
    );
  }
  return currentAdapter!;
}

export const stdout: WriteStream = {
  write: (chunk) => requireAdapter().stdout.write(chunk),
  get isTTY() {
    return requireAdapter().stdout.isTTY;
  },
  get columns() {
    return requireAdapter().stdout.columns;
  },
  get rows() {
    return requireAdapter().stdout.rows;
  },
};

export const stderr: WriteStream = {
  write: (chunk) => requireAdapter().stderr.write(chunk),
  get isTTY() {
    return requireAdapter().stderr.isTTY;
  },
  get columns() {
    return requireAdapter().stderr.columns;
  },
  get rows() {
    return requireAdapter().stderr.rows;
  },
};

export const stdin: ReadStream = {
  get isTTY() {
    return requireAdapter().stdin.isTTY;
  },
  read: () => requireAdapter().stdin.read(),
};

export function cwd(): string {
  return requireAdapter().cwd();
}

export function chdir(dir: string): void {
  requireAdapter().chdir(dir);
}

export function platform(): string {
  return requireAdapter().platform();
}

export function exit(code?: number): never {
  return requireAdapter().exit(code);
}

export function setExitCode(code: number): void {
  requireAdapter().setExitCode(code);
}

export function onSignal(name: SignalName, handler: () => void): () => void {
  return requireAdapter().onSignal(name, handler);
}

/**
 * Mutate the `env` snapshot. Use sparingly — `env` is intended to be
 * immutable after registration. Legitimate uses: test setup, dotenv
 * shims at boot. Updates both the underlying adapter and the exported
 * `env` object's contents.
 */
export function setEnv(key: string, value: string | undefined): void {
  requireAdapter().setEnv(key, value);
  if (value === undefined) {
    delete envInternal[key];
  } else {
    envInternal[key] = value;
  }
}

export function registerProcessAdapter(adapter: ProcessAdapter): void {
  currentAdapter = adapter;
  for (const k of Object.keys(envInternal)) delete envInternal[k];
  Object.assign(envInternal, adapter.envSnapshot());
  argvInternal.length = 0;
  argvInternal.push(...adapter.argvSnapshot());
}

export function getProcessAdapter(): ProcessAdapter {
  return requireAdapter();
}

let nodeAttempted = false;

function tryAutoRegisterNode(): boolean {
  if (currentAdapter) return true;
  if (nodeAttempted) return false;
  nodeAttempted = true;
  const proc = (globalThis as { process?: NodeJS.Process }).process;
  if (!proc?.versions?.node) return false;
  registerProcessAdapter(buildNodeAdapter(proc));
  return true;
}

function buildNodeAdapter(proc: NodeJS.Process): ProcessAdapter {
  return {
    envSnapshot: () => ({ ...proc.env }),
    argvSnapshot: () => [...proc.argv],
    cwd: () => proc.cwd(),
    chdir: (dir) => proc.chdir(dir),
    platform: () => proc.platform,
    setEnv: (key, value) => {
      if (value === undefined) delete proc.env[key];
      else proc.env[key] = value;
    },
    exit: (code) => proc.exit(code) as never,
    setExitCode: (code) => {
      proc.exitCode = code;
    },
    onSignal: (name, handler) => {
      proc.on(name, handler);
      return () => {
        proc.off(name, handler);
      };
    },
    stdout: {
      write: (chunk) => proc.stdout.write(chunk),
      get isTTY() {
        return Boolean(proc.stdout.isTTY);
      },
      get columns() {
        return proc.stdout.columns;
      },
      get rows() {
        return proc.stdout.rows;
      },
    },
    stderr: {
      write: (chunk) => proc.stderr.write(chunk),
      get isTTY() {
        return Boolean(proc.stderr.isTTY);
      },
      get columns() {
        return proc.stderr.columns;
      },
      get rows() {
        return proc.stderr.rows;
      },
    },
    stdin: {
      get isTTY() {
        return Boolean(proc.stdin.isTTY);
      },
      read: () =>
        new Promise<string | null>((resolve) => {
          const onData = (data: Buffer) => {
            cleanup();
            resolve(data.toString());
          };
          const onEnd = () => {
            cleanup();
            resolve(null);
          };
          const cleanup = () => {
            proc.stdin.off("data", onData);
            proc.stdin.off("end", onEnd);
          };
          proc.stdin.once("data", onData);
          proc.stdin.once("end", onEnd);
        }),
    },
  };
}

/**
 * Test-only helper. Resets the adapter registry and clears `env`/`argv`
 * snapshots so a subsequent `registerProcessAdapter` call (or auto-register)
 * starts fresh. Production code should not call this.
 */
export function _resetProcessAdapter(): void {
  currentAdapter = null;
  nodeAttempted = false;
  for (const k of Object.keys(envInternal)) delete envInternal[k];
  argvInternal.length = 0;
}
