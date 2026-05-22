import { AbstractHandler } from "./abstract/handler.js";
import { AbstractRequest } from "./abstract/request.js";
import type { RackApp } from "../mock-request.js";

export class BasicRequest extends AbstractRequest {
  basic(): boolean {
    return this.scheme() === "basic" && this.credentials().length === 2;
  }

  credentials(): string[] {
    const decoded = Buffer.from(this.params(), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx === -1) return [decoded];
    return [decoded.slice(0, idx), decoded.slice(idx + 1)];
  }

  username(): string {
    return this.credentials()[0];
  }
}

export class Basic extends AbstractHandler {
  static readonly Request = BasicRequest;

  constructor(
    app: RackApp,
    realm?: string,
    authenticator?: (...args: any[]) => boolean | Promise<boolean>,
  ) {
    super(app, realm, authenticator);
  }

  async call(env: Record<string, any>): Promise<[number, Record<string, string>, any]> {
    const auth = new BasicRequest(env);

    if (!auth.provided()) return this.unauthorized();
    if (!auth.basic()) return this.badRequest();

    if (await this.authenticator(...auth.credentials())) {
      env["REMOTE_USER"] = auth.username();
      return this.app(env);
    }

    return this.unauthorized();
  }

  protected challenge(): string {
    return `Basic realm="${this.realm}"`;
  }
}
