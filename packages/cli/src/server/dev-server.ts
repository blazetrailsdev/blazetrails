import { createServer, type ViteDevServer } from "vite";
import { trailsPlugin } from "./vite-plugin.js";

export interface DevServerOptions {
  port: number;
  host: string;
  cwd: string;
}

export class DevServer {
  private port: number;
  private host: string;
  private cwd: string;
  private server: ViteDevServer | null = null;

  constructor(options: DevServerOptions) {
    this.port = options.port;
    this.host = options.host;
    this.cwd = options.cwd;
  }

  async start(): Promise<void> {
    this.server = await createServer({
      root: this.cwd,
      plugins: [trailsPlugin({ cwd: this.cwd })],
      server: {
        port: this.port,
        host: this.host,
        strictPort: false,
      },
      // Suppress Vite's own console output in favor of trails-style logging
      logLevel: "info",
      appType: "custom",
    });

    await this.server.listen();

    const address = this.server.httpServer?.address();
    const actualPort = address && typeof address === "object" ? address.port : this.port;

    console.log(
      `=> Trails application starting in development on http://${this.host}:${actualPort}`,
    );
    console.log(`=> Vite dev server with HMR enabled`);
    console.log(`=> Ctrl+C to stop`);
    console.log("");
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
  }
}
