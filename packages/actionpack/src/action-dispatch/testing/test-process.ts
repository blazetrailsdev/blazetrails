/**
 * Port of `ActionDispatch::TestProcess`.
 *
 * Rails source: actionpack/lib/action_dispatch/testing/test_process.rb
 *
 * A mixin of helpers exposed on integration-test hosts that expose
 * `@request` / `@response`. Use the `this`-typed function pattern from
 * CLAUDE.md so the helpers live in this file (matching Rails layout) and
 * type-check against a host interface.
 */

import { getFs } from "@blazetrails/activesupport";

import { CookieJar } from "../middleware/cookies.js";
import type { FlashHash } from "../middleware/flash.js";
import { UploadedFile } from "../http/upload.js";

/**
 * Minimal request shape the TestProcess helpers depend on.
 *
 * @internal
 */
export interface TestProcessRequest {
  session: Record<string, unknown>;
  flash: FlashHash;
  cookies: Record<string, string>;
}

/**
 * Minimal response shape the TestProcess helpers depend on.
 *
 * @internal
 */
export interface TestProcessResponse {
  redirectUrl?: string;
}

/**
 * Host interface for `TestProcess` and the nested `FixtureFile` mixin.
 *
 * @internal
 */
export interface TestProcessHost {
  request: TestProcessRequest;
  response: TestProcessResponse;
  _cookieJar?: CookieJar;
  /** ActiveSupport::Testing::FileFixtures hook. */
  fileFixture?(path: string): string;
  constructor: {
    fileFixturePath?: string | null;
  };
}

/**
 * Shortcut for `Rack::Test::UploadedFile.new(File.join(file_fixture_path, path), type)`.
 *
 *     post(:change_avatar, { params: { avatar: fileFixtureUpload("david.png", "image/png") } });
 *
 * Default fixture files location is `test/fixtures/files`.
 *
 * Pass `true` as the third parameter to upload binary files.
 */
export function fileFixtureUpload(
  this: TestProcessHost,
  path: string,
  mimeType?: string | null,
  binary: boolean = false,
): UploadedFile {
  const fs = getFs();
  let resolved = path;
  if (this.constructor.fileFixturePath && !fs.existsSync(path)) {
    if (!this.fileFixture) {
      throw new Error(
        "TestProcess#fileFixtureUpload: host does not implement fileFixture(); include ActiveSupport::Testing::FileFixtures.",
      );
    }
    resolved = this.fileFixture(path);
  }
  const filename = resolved.split("/").pop() ?? resolved;
  return new UploadedFile({
    filename,
    type: mimeType ?? undefined,
    tempfile: resolved,
    head: binary ? "Content-Transfer-Encoding: binary" : undefined,
  });
}

/** Alias of {@link fileFixtureUpload}. */
export const fixtureFileUpload = fileFixtureUpload;

/**
 * `assigns` has been extracted to a gem in Rails. Mirror the error so tests
 * relying on the legacy helper get the same message.
 */
export function assigns(this: TestProcessHost, _key?: string | symbol): never {
  throw new Error(
    'NoMethodError: assigns has been extracted to a gem. To continue using it, add `gem "rails-controller-testing"` to your Gemfile.',
  );
}

export function session(this: TestProcessHost): Record<string, unknown> {
  return this.request.session;
}

export function flash(this: TestProcessHost): FlashHash {
  return this.request.flash;
}

export function cookies(this: TestProcessHost): CookieJar {
  if (!this._cookieJar) {
    this._cookieJar = CookieJar.build(this.request, this.request.cookies);
  }
  return this._cookieJar;
}

export function redirectToUrl(this: TestProcessHost): string | undefined {
  return this.response.redirectUrl;
}

/**
 * Namespace object mirroring Rails' `ActionDispatch::TestProcess` module so
 * that `api:compare` can locate the ported methods at the expected layout.
 */
export const TestProcess = {
  fileFixtureUpload,
  fixtureFileUpload,
  assigns,
  session,
  flash,
  cookies,
  redirectToUrl,
};

/**
 * Nested `ActionDispatch::TestProcess::FixtureFile` module.
 */
export const FixtureFile = {
  fileFixtureUpload,
  fixtureFileUpload,
};
