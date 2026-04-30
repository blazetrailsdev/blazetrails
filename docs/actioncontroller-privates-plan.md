# ActionController `--privates` — remaining backlog

Each row is one PR. Pick a row, follow the steps below verbatim, open a draft PR.

## How to ship one PR

```bash
# 1. Branch from latest origin/main in a fresh worktree
git fetch origin main
git worktree add .claude/worktrees/<slug> -b <branch> origin/main
cd .claude/worktrees/<slug>
pnpm install

# 2. Read Rails source first (the entire file, not just the missing methods)
less scripts/api-compare/.rails-source/actionpack/lib/<rails-file>.rb

# 3. Implement in the TS file the api:compare row points to.
#    Do NOT relocate methods to a helper file or the row stops counting.
#    Use cwd-relative paths (`packages/...`), never absolute paths into the user's repo.
$EDITOR packages/actionpack/src/actioncontroller/<ts-file>.ts

# 4. Add tests next to the source as <ts-file>.test.ts
$EDITOR packages/actionpack/src/actioncontroller/<ts-file>.test.ts
pnpm test packages/actionpack/src/actioncontroller/<ts-file>.test.ts

# 5. Refresh and confirm api:compare row hits 100%
bash scripts/api-compare/fetch-rails.sh
ruby scripts/api-compare/extract-ruby-api.rb
pnpm tsx scripts/api-compare/extract-ts-api.ts
pnpm tsx scripts/api-compare/compare.ts --package actioncontroller --privates | grep <rails-file>

# 6. Build clean, prettier clean
pnpm build
pnpm exec prettier --write packages/actionpack/src/actioncontroller/<ts-file>.ts \
                            packages/actionpack/src/actioncontroller/<ts-file>.test.ts

# 7. Commit (NO --no-verify, NO Co-Authored-By trailer) + push
git add -A
git commit -m "feat(actioncontroller): <commit subject>"
git push -u origin <branch>

# 8. Open as draft. PR body MUST quote the Rails source line(s) being mirrored
#    and reference the plan slot (e.g. "Implements P3").
gh pr create --draft --title "feat(actioncontroller): <title>" --body "$(cat <<EOF
...
EOF
)"
```

Constraints (CLAUDE.md):

- camelCase only — no snake_case identifiers, even mirroring Rails payload keys.
- PR ≤ 300 LOC additions+deletions (excl. lockfiles, snapshots).
- For methods that mix in to controllers, use the `this`-typed function pattern
  documented in CLAUDE.md (`export function foo(this: HostInterface, ...)` then
  `static foo = foo` in `base.ts`). Do NOT inline the body in `base.ts`.
- For Rails behaviors that can't be mirrored exactly (missing infra, etc.),
  add a "Known divergences" entry in `docs/actioncontroller-100-percent.md`
  describing what Rails does, what we do, and why.
- `instance_exec(opts, &block)` → `block.call(this, opts)` with `this: unknown`
  threaded through the function signature.
- Ruby `compact` → `.filter((e) => e !== null && e !== undefined)`, NOT
  `.filter(Boolean)` (which also drops `0`, `""`, `false`).
- Ruby `Hash#key?` → `"K" in obj`, NOT `obj["K"] != null` (Ruby returns true
  for nil values).

Sequencing rules:

- One agent per source file at a time; methods in the same file collide.
- Wave 4 (core) is **serial** — each PR depends on the prior one shipping.

---

## Wave 0 — single-file peripherals (remaining)

| PR  | Rails file                | Missing | TS file (api:compare row) | Methods                                                                                                                                                                              |
| --- | ------------------------- | ------: | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P2  | `metal/rate_limiting.rb`  |       2 | `metal/rate-limiting.ts`  | `rateLimit` (class DSL), `rateLimiting` (private instance). Mirror Rails options `to:`, `within:`, `by:`, `with:`, `store:`, `name:`, `only:`/`except:`. Cache backend is divergent. |
| P3  | `form_builder.rb`         |       1 | `form-builder.ts`         | `defaultFormBuilder` — class DSL accepting builder class or string name (resolve via existing `@blazetrails/activesupport` constant resolver).                                       |
| P4  | `metal/data_streaming.rb` |       1 | `metal/data-streaming.ts` | `sendFileHeadersBang` (`send_file_headers!`). Refactor existing `send_file`/`send_data` to delegate. RFC 6266 with both `filename="..."` ASCII fallback and `filename*=UTF-8''...`.  |
| P7  | `metal/renderers.rb`      |       2 | `metal/renderers.ts`      | `_renderToBodyWithRenderer`, `_renderWithRendererMethodName`. Refactor existing inline dispatch logic into named methods; `Renderers.add` registration must still resolve.           |
| P9  | `deprecator.rb`           |       3 | `deprecator.ts`           | `deprecator` (Deprecation instance), `addRenderer`, `removeRenderer` (deprecation shims delegating to Renderers registry).                                                           |

## Wave 1 — small bundle peripherals

Ship after Wave 0 lands. One PR per row.

| PR  | Rails file                           | Missing | Notes                                                                                                                                             |
| --- | ------------------------------------ | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| P10 | `metal/content_security_policy.rb`   |       4 | `isContentSecurityPolicy?`, `currentContentSecurityPolicy`, `contentSecurityPolicy`, `contentSecurityPolicyReportOnly` — class DSL.               |
| P11 | `metal/etag_with_template_digest.rb` |       3 | `determineTemplateEtag`, `pickTemplateForEtag`, `lookupAndDigestTemplate`. Depends on actionview digestor — stub if not yet ported, document gap. |
| P12 | `metal/helpers.rb`                   |       5 | `helpersPath`, `helpers`, `helperAttr`, `modulesForHelpers`, `allApplicationHelpers`. Requires actionview helper integration.                     |

## Wave 2 — medium peripherals

| PR  | Rails file                           | Missing | Notes                                                                                                                                                                   |
| --- | ------------------------------------ | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P14 | `metal/redirecting.rb` (privates)    |       6 | `_computeRedirectToLocation`, `_allowOtherHost`, `_extractRedirectToStatus`, `_enforceOpenRedirectProtection`, `_isUrlHostAllowed`, `_ensureUrlIsHttpHeaderSafe`.       |
| P15 | `metal/params_wrapper.rb` (privates) |       8 | `_defaultWrapModel`, `_wrapperKey`, `_wrapperFormats`, `_wrapParameters`, `_extractParameters`, `_isWrapperEnabled`, `_performParameterWrapping`, `_setWrapperOptions`. |

## Wave 3 — split-file PRs

Each Rails file below is too large for one ≤300-LOC PR. Sub-PRs serialize on
the same TS file, so ship them in alphabetical order (a → b → c).

### `metal/http_authentication.rb` (33 missing) — `metal/http-authentication.ts`

| PR   | Module   | Missing | Methods                                                                                                                                                                                                                 |
| ---- | -------- | ------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P17a | `Basic`  |      13 | `authenticate`, `hasBasicCredentials`, `userNameAndPassword`, `decodeCredentials`, `authScheme`, `authParam`, `encodeCredentials`, `authenticationRequest` + 5 controller-side helpers (`httpBasicAuthenticate*` etc.). |
| P17b | `Digest` |      12 | `validateDigestResponse`, `expectedResponse`, `ha1`, `decodeCredentialsHeader`, `authenticationHeader`, `secretToken`, `nonce`, `validateNonce`, `opaque` + 3 controller-side helpers.                                  |
| P17c | `Token`  |       8 | `tokenAndOptions`, `tokenParamsFrom`, `paramsArrayFrom`, `rewriteParamValues`, `rawParams` + 3 controller-side helpers.                                                                                                 |

### `metal/live.rb` (22 missing) — `metal/live.ts`

| PR   | Subject              | Missing | Methods                                                                                                                                                                                                         |
| ---- | -------------------- | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P18a | `Live::Buffer` class |      12 | `performWrite`, `queueSize`, `ignoreDisconnect`, `writeln`, `abort`, `isConnected`, `onError`, `callOnError`, `eachChunk`, `buildQueue`, `beforeCommitted`, `buildBuffer`.                                      |
| P18b | `Live` mixin         |      10 | `process`, `responseBody=`, `sendStream`, `newControllerThread`, `cleanUpThreadLocals`, `logError`, `originalNewControllerThread`, `originalCleanUpThreadLocals`, `liveThreadPoolExecutor`, `makeResponseBang`. |

### `metal/request_forgery_protection.rb` (31 missing) — `metal/request-forgery-protection.ts`

| PR   | Subject                              | Missing | Methods                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------ | ------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P20a | Verification predicates              |      10 | `isVerifiedRequest`, `verifySameOriginRequest`, `markForSameOriginVerificationBang`, `isMarkedForSameOriginVerification`, `isNonXhrJavascriptResponse`, `isValidRequestOrigin`, `isProtectAgainstForgery`, `unverifiedRequestWarningMessage`, `normalizeActionPath`, `normalizeRelativeActionPath`. |
| P20b | Token generation/encoding            |      11 | `generateCsrfToken`, `encodeCsrfToken`, `decodeCsrfToken`, `maskToken`, `unmaskToken`, `maskedAuthenticityToken`, `realCsrfToken`, `perFormCsrfToken`, `globalCsrfToken`, `csrfTokenHmac`, `xorByteStrings`.                                                                                        |
| P20c | Token validation + strategy plumbing |      10 | `isAnyAuthenticityTokenValid`, `requestAuthenticityTokens`, `isValidAuthenticityToken`, `isValidPerFormCsrfToken`, `compareWithRealToken`, `compareWithGlobalToken`, `formAuthenticityParam`, `protectionMethodClass`, `storageStrategy`, `isIsStorageStrategy`.                                    |

### `test_case.rb` (36 missing) — `test-case.ts`

| PR   | Collaborator         | Missing | Methods                                                                                                                                                                                                                                                        |
| ---- | -------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P21a | `TestSession`        |      12 | `isEnabled`, `idWas`, `loadBang`, `keys`, `values`, `destroy`, `dig`, `fetch`, `isExists`, `isSuccess`, `isMissing`, `isError`.                                                                                                                                |
| P21b | `TestRequest`/params |      12 | `assignParameters`, `queryString=`, `contentType=`, `shouldMultipart`, `paramsParsers`, `queryParameterNames`, `defaultEnv`, `newSession`, `create`, `controllerClass`, `generatedPath`, `executorAroundEachRequest`.                                          |
| P21c | Behavior mixin       |      12 | `process`, `controllerClassName`, `setupControllerRequestAndResponse`, `buildResponse`, `setupRequest`, `wrapExecution`, `processControllerResponse`, `scrubEnvBang`, `documentRootElement`, `checkRequiredIvars`, `tests`, `determineDefaultControllerClass`. |

## Wave 4 — core (strict serial order: P22 → P23 → P24 → P25 → P26)

These touch the controller backbone and depend on prior peripherals. Do not
fan out.

| PR  | Rails file                 | Missing | Methods                                                                                           |
| --- | -------------------------- | ------: | ------------------------------------------------------------------------------------------------- |
| P22 | `metal/instrumentation.rb` |       3 | `haltedCallbackHook`, `cleanupViewRuntime`, `appendInfoToPayload`. Hooks render + callback chain. |
| P23 | `api/api_rendering.rb`     |       1 | `renderToBody` API override. Depends on `metal/rendering.rb` privates (P16).                      |
| P24 | `metal/implicit_render.rb` |       3 | `defaultRender`, `methodForAction`, `isInteractiveBrowserRequest`. Uses rendering stack.          |
| P26 | `base.rb` (privates)       |       2 | `_protectedIvars`, `withoutModules`. Final composition.                                           |

---

## Tracking

When a PR merges: strike through the row and append `#NNNN ✅`. Update the
remaining count by re-running:

```bash
pnpm tsx scripts/api-compare/extract-ts-api.ts
pnpm tsx scripts/api-compare/compare.ts --package actioncontroller --privates | tail -1
```
