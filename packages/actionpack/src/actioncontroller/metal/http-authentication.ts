/**
 * ActionController::HttpAuthentication
 *
 * Re-exports the HTTP Basic, Digest, and Token authentication helpers
 * from ActionDispatch.
 * @see https://api.rubyonrails.org/classes/ActionController/HttpAuthentication.html
 */

export {
  BasicAuth,
  TokenAuth,
  DigestAuth,
  type BasicAuthCredentials,
  type TokenAuthCredentials,
  type DigestAuthParams,
} from "../../actiondispatch/http-authentication.js";

export interface HttpAuthentication {
  authenticateOrRequestWithHttpBasic(
    realm?: string,
    message?: string,
    block?: (name: string, password: string) => boolean,
  ): boolean;
}

export interface Basic {
  authenticateOrRequestWithHttpBasic(
    realm?: string,
    message?: string,
    block?: (name: string, password: string) => boolean,
  ): boolean;
  authenticateWithHttpBasic(block: (name: string, password: string) => boolean): boolean;
  requestHttpBasicAuthentication(realm?: string, message?: string): void;
}

export interface ClassMethods {
  httpBasicAuthenticateWith(options: { name: string; password: string; realm?: string }): void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ControllerMethods extends Basic {}

export interface Digest {
  authenticateOrRequestWithHttpDigest(
    realm?: string,
    block?: (username: string) => string | null,
  ): boolean;
  authenticateWithHttpDigest(
    realm: string,
    block: (username: string) => string | null,
  ): string | null;
}

export interface Token {
  authenticateOrRequestWithHttpToken(
    realm?: string,
    message?: string,
    block?: (token: string, options: Record<string, string>) => boolean,
  ): boolean;
  authenticateWithHttpToken(
    block: (token: string, options: Record<string, string>) => boolean,
  ): boolean;
  requestHttpTokenAuthentication(realm?: string, message?: string): void;
}
