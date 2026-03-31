/**
 * ActionController::HttpAuthentication
 *
 * HTTP Basic, Digest, and Token authentication.
 * @see https://api.rubyonrails.org/classes/ActionController/HttpAuthentication.html
 */

/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-namespace */

export interface HttpAuthentication {}

export interface ControllerMethods {
  authenticateOrRequestWithHttpBasic(
    realm?: string,
    message?: string,
    block?: (name: string, password: string) => boolean,
  ): boolean;
  authenticateOrRequestWithHttpDigest(
    realm?: string,
    block?: (username: string) => string | null,
  ): boolean;
  authenticateOrRequestWithHttpToken(
    realm?: string,
    message?: string,
    block?: (token: string, options: Record<string, string>) => boolean,
  ): boolean;
}

export interface ClassMethods {}

export interface BasicControllerMethods {
  httpBasicAuthenticateWith(options: { name: string; password: string; realm?: string }): void;
  authenticateOrRequestWithHttpBasic(
    realm?: string,
    message?: string,
    block?: (name: string, password: string) => boolean,
  ): boolean;
}

export interface DigestControllerMethods {
  authenticateOrRequestWithHttpDigest(
    realm?: string,
    block?: (username: string) => string | null,
  ): boolean;
}

export interface TokenControllerMethods {
  authenticateOrRequestWithHttpToken(
    realm?: string,
    message?: string,
    block?: (token: string, options: Record<string, string>) => boolean,
  ): boolean;
}

export namespace Basic {
  export interface ControllerMethods {
    httpBasicAuthenticateWith(options: { name: string; password: string; realm?: string }): void;
    authenticateOrRequestWithHttpBasic(
      realm?: string,
      message?: string,
      block?: (name: string, password: string) => boolean,
    ): boolean;
    requestHttpBasicAuthentication(realm?: string, message?: string): void;
    authenticateWithHttpBasic(block: (name: string, password: string) => boolean): boolean;
  }

  export function decodeCredentials(header: string): [string, string] {
    const decoded = Buffer.from(header.replace(/^Basic\s+/, ""), "base64").toString("utf-8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return [decoded, ""];
    return [decoded.slice(0, idx), decoded.slice(idx + 1)];
  }

  export function encodeCredentials(name: string, password: string): string {
    return `Basic ${Buffer.from(`${name}:${password}`).toString("base64")}`;
  }

  export function authenticationRequest(
    realm: string = "Application",
    message: string = "HTTP Basic: Access denied.\n",
  ): { headers: Record<string, string>; status: number; body: string } {
    return {
      headers: { "www-authenticate": `Basic realm="${realm}"` },
      status: 401,
      body: message,
    };
  }
}

export namespace Digest {
  export interface ControllerMethods {
    authenticateOrRequestWithHttpDigest(
      realm?: string,
      block?: (username: string) => string | null,
    ): boolean;
    requestHttpDigestAuthentication(realm?: string, message?: string): void;
    authenticateWithHttpDigest(
      realm: string,
      block: (username: string) => string | null,
    ): string | null;
  }
}

export namespace Token {
  export interface ControllerMethods {
    authenticateOrRequestWithHttpToken(
      realm?: string,
      message?: string,
      block?: (token: string, options: Record<string, string>) => boolean,
    ): boolean;
    requestHttpTokenAuthentication(realm?: string, message?: string): void;
    authenticateWithHttpToken(
      block: (token: string, options: Record<string, string>) => boolean,
    ): boolean;
  }

  export function encodeCredentials(token: string, options: Record<string, string> = {}): string {
    const pairs = Object.entries(options)
      .map(([k, v]) => `${k}="${v}"`)
      .join(", ");
    return pairs ? `Token token="${token}", ${pairs}` : `Token token="${token}"`;
  }
}
