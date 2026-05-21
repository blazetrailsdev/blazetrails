/**
 * Trailtie — initialization hooks for ActiveSupport.
 *
 * Mirrors: ActiveSupport::Railtie < ::Rails::Railtie
 * (activesupport/lib/active_support/railtie.rb)
 *
 * Resolves docs/trailties-plan.md open question #2: the activesupport
 * trailtie lives **inside the trailties package** (not in activesupport
 * itself) so the dependency direction stays trailties → activesupport.
 * Putting it under `packages/activesupport/src/` would force activesupport
 * to depend on `@blazetrails/activesupport`'s own Railtie base via a
 * self-import, and worse, would couple the leaf framework to the
 * application-runner concept it should stay agnostic of.
 *
 * Only the initializers whose targets are already ported to trails are
 * wired here. The rest are documented as skipped on the PR (and become
 * follow-ups as the underlying helpers land):
 *
 *   - active_support.isolation_level — IsolatedExecutionState has no
 *     `isolationLevel` setter yet
 *   - active_support.raise_on_invalid_cache_expiration_time — Cache::Store
 *     has no equivalent flag
 *   - active_support.set_authenticated_message_encryption — MessageEncryptor
 *     has no `useAuthenticatedMessageEncryption` toggle
 *   - active_support.reset_execution_context — no reloader/executor in trails
 *   - active_support.reset_all_current_attributes_instances — same
 *   - active_support.deprecation_behavior — Deprecation has no
 *     `silenced`/`behavior` setters wired through Application
 *   - active_support.initialize_time_zone — no TZInfo binding
 *   - active_support.to_time_preserves_timezone — flag not ported
 *   - active_support.initialize_beginning_of_week — Date.beginning_of_week
 *     not ported
 *   - active_support.require_master_key — credentials key lookup runs
 *     elsewhere
 *   - active_support.set_configs — generic setter-dispatch loop;
 *     intentionally deferred until each target landed
 *   - active_support.set_key_generator_hash_digest_class — KeyGenerator's
 *     hashDigestClass is per-instance, not class-level
 *   - active_support.set_default_message_serializer — Messages::Codec not
 *     ported
 *   - active_support.set_use_message_serializer_for_metadata — same
 */
import { Railtie as BaseRailtie, registerRailtie, deprecator } from "@blazetrails/activesupport";
import { Digest } from "@blazetrails/activesupport/digest";

export interface HashDigestClass {
  hexdigest(data: string): string;
}

export interface ActiveSupportConfig {
  hashDigestClass?: HashDigestClass;
}

export interface TrailtieConfig {
  activeSupport?: ActiveSupportConfig;
}

/**
 * Trailtie wiring for ActiveSupport.
 *
 * Mirrors: ActiveSupport::Railtie (activesupport/lib/active_support/railtie.rb)
 */
export class Trailtie extends BaseRailtie {
  static {
    registerRailtie(this);

    // Mirrors `config.active_support = ActiveSupport::OrderedOptions.new`.
    (Trailtie.config as TrailtieConfig).activeSupport ??= {};

    this.initializer("active_support.deprecator", () => {
      BaseRailtie.deprecators["activeSupport"] = deprecator;
    });

    this.initializer("active_support.set_hash_digest_class", () => {
      const klass = (Trailtie.config as TrailtieConfig).activeSupport?.hashDigestClass;
      if (klass) {
        Digest.hashDigestClass = klass;
      }
    });
  }
}
