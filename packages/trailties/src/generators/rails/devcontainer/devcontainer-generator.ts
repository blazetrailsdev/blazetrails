// Mirrors railties/lib/rails/generators/rails/devcontainer/devcontainer_generator.rb.
// compose.yaml / devcontainer.json are emitted as JSON syntax (YAML 1.2
// is a strict superset of JSON; Compose accepts it). Dockerfile is raw.

import { GeneratorBase, type GeneratorOptions } from "../../base.js";
import { Database, DATABASES, type DatabaseName } from "../../database.js";

export const TRAILS_DEV_PATH = "/workspaces/trails";
export type SqliteDriver = "better-sqlite3" | "node-sqlite" | "expo-sqlite";

export interface DevcontainerGeneratorOptions extends GeneratorOptions {
  appName?: string;
  database?: DatabaseName;
  redis?: boolean;
  systemTest?: boolean;
  activeStorage?: boolean;
  node?: boolean;
  dev?: boolean;
  kamal?: boolean;
  sqliteDriver?: SqliteDriver;
  nodeVersion?: string;
}

type JsonObject = { [k: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type ResolvedOptions = Required<Omit<DevcontainerGeneratorOptions, "cwd" | "output">>;

export class DevcontainerGenerator extends GeneratorBase {
  readonly opts: ResolvedOptions;
  readonly database: Database;

  constructor(options: DevcontainerGeneratorOptions) {
    super(options);
    const database = options.database ?? "sqlite3";
    if (!(DATABASES as readonly string[]).includes(database)) {
      throw new Error(`Unknown database: ${database}`);
    }
    this.opts = {
      appName: options.appName ?? "rails_app",
      database,
      redis: options.redis !== false,
      systemTest: options.systemTest !== false,
      activeStorage: options.activeStorage !== false,
      node: options.node === true,
      dev: options.dev === true,
      kamal: options.kamal !== false,
      sqliteDriver: options.sqliteDriver ?? "better-sqlite3",
      nodeVersion: options.nodeVersion ?? "22.0.0",
    };
    this.database = Database.build(database);
  }

  run(): string[] {
    this.createFile(".devcontainer/devcontainer.json", this.devcontainerJson());
    this.createFile(".devcontainer/Dockerfile", this.dockerfile());
    this.createFile(".devcontainer/compose.yaml", this.composeYaml());
    this.gsubFile(
      "test/application_system_test_case.ts",
      /^\s*drivenBy\b.*$/m,
      this.systemTestConfiguration(),
      this.opts.systemTest,
    );
    this.gsubFile(
      "src/config/database.ts",
      /host:\s*"localhost"/g,
      'host: process.env.DB_HOST ?? "localhost"',
      this.opts.database === "postgresql",
    );
    return this.getCreatedFiles();
  }

  private gsubFile(rel: string, re: RegExp, replacement: string, enabled: boolean): void {
    if (!enabled || !this.fileExists(rel)) return;
    const full = this.path.join(this.cwd, rel);
    this.fs.writeFileSync(full, this.fs.readFileSync(full, "utf-8").replace(re, replacement));
    this.output(`      update  ${rel}`);
  }

  private devcontainerJson(): string {
    const { dev, appName } = this.opts;
    const env = this.containerEnv();
    const json: JsonObject = {
      name: appName,
      dockerComposeFile: "compose.yaml",
      service: "rails-app",
      workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
      features: this.features(),
    };
    if (Object.keys(env).length > 0) json.containerEnv = env;
    json.forwardPorts = this.forwardPorts();
    if (dev) json.mounts = [{ type: "bind", source: TRAILS_DEV_PATH, target: TRAILS_DEV_PATH }];
    json.postCreateCommand = "bin/setup --skip-server";
    return JSON.stringify(json, null, 2) + "\n";
  }

  private dockerfile(): string {
    return `ARG NODE_VERSION=${this.opts.nodeVersion}\nFROM mcr.microsoft.com/devcontainers/javascript-node:1-\${NODE_VERSION}\n`;
  }

  private composeYaml(): string {
    const { systemTest, redis, appName } = this.opts;
    const dbName = this.database.name;
    const dbService = this.database.service;
    const deps: string[] = [];
    if (systemTest) deps.push("selenium");
    if (redis) deps.push("redis");
    if (dbService) deps.push(dbName);
    const railsApp: JsonObject = {
      build: { context: "..", dockerfile: ".devcontainer/Dockerfile" },
      volumes: ["../..:/workspaces:cached"],
      command: "sleep infinity",
    };
    if (deps.length > 0) railsApp.depends_on = deps;
    const services: JsonObject = { "rails-app": railsApp };
    if (systemTest)
      services.selenium = { image: "selenium/standalone-chromium", restart: "unless-stopped" };
    if (redis)
      services.redis = {
        image: "redis:7.2",
        restart: "unless-stopped",
        volumes: ["redis-data:/data"],
      };
    if (dbService) services[dbName] = dbService as unknown as JsonObject;
    const yaml: JsonObject = { name: appName, services };
    const volumes: JsonObject = {};
    if (redis) volumes["redis-data"] = null;
    if (this.database.volume) volumes[this.database.volume] = null;
    if (Object.keys(volumes).length > 0) yaml.volumes = volumes;
    return JSON.stringify(yaml, null, 2) + "\n";
  }

  private containerEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    if (this.opts.systemTest) {
      env.CAPYBARA_SERVER_PORT = "45678";
      env.SELENIUM_HOST = "selenium";
    }
    if (this.opts.redis) env.REDIS_URL = "redis://redis:6379/1";
    if (this.opts.kamal) env.KAMAL_REGISTRY_PASSWORD = "$KAMAL_REGISTRY_PASSWORD";
    if (this.database.service) env.DB_HOST = this.database.name;
    return env;
  }

  private features(): JsonObject {
    const f: JsonObject = { "ghcr.io/devcontainers/features/github-cli:1": {} };
    if (this.opts.activeStorage) f["ghcr.io/rails/devcontainer/features/activestorage"] = {};
    if (this.opts.node) f["ghcr.io/devcontainers/features/node:1"] = {};
    if (this.opts.kamal) f["ghcr.io/devcontainers/features/docker-outside-of-docker:1"] = {};
    const dbf = this.database.feature;
    const includeDb =
      this.opts.database !== "sqlite3" || this.opts.sqliteDriver === "better-sqlite3";
    if (dbf && includeDb) Object.assign(f, dbf);
    return f;
  }

  private forwardPorts(): number[] {
    const ports = [3000];
    if (this.database.port) ports.push(this.database.port);
    if (this.opts.redis) ports.push(6379);
    return ports;
  }

  private systemTestConfiguration(): string {
    return `  if (process.env.CAPYBARA_SERVER_PORT) {
    servedBy({ host: "rails-app", port: process.env.CAPYBARA_SERVER_PORT });
    drivenBy(":selenium", { using: ":headless_chrome", screenSize: [1400, 1400], options: { browser: ":remote", url: \`http://\${process.env.SELENIUM_HOST}:4444\` } });
  } else {
    drivenBy(":selenium", { using: ":headless_chrome", screenSize: [1400, 1400] });
  }`;
  }
}
