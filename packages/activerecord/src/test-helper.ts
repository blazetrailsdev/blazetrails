/**
 * Test helpers that mirror Rails' ActiveRecord::TestCase helpers.
 *
 * Mirrors: activerecord/test/cases/test_case.rb
 */
import { getDefaultTimezone, setDefaultTimezone } from "./type/internal/timezone.js";
import { Base } from "./base.js";

interface TimezoneConfig {
  /** Mirrors Rails' `default_timezone` — "utc" or "local". */
  default?: "utc" | "local";
  /** Mirrors Rails' `time_zone_aware_attributes`. */
  awareAttributes?: boolean;
  /** Mirrors Rails' `time_zone_aware_types`. */
  awareTypes?: string[];
}

/**
 * Temporarily applies timezone-related configuration, yields, then restores.
 *
 * Mirrors: ActiveRecord::TestCase#with_timezone_config
 */
export async function withTimezoneConfig(
  cfg: TimezoneConfig,
  fn: () => Promise<void> | void,
): Promise<void> {
  const oldDefault = getDefaultTimezone();
  const base = Base as any;
  const oldAwareAttributes: boolean | undefined = base.timeZoneAwareAttributes;
  const oldAwareTypes: string[] | undefined = base.timeZoneAwareTypes;

  try {
    if (cfg.default !== undefined) setDefaultTimezone(cfg.default);
    if (cfg.awareAttributes !== undefined && "timeZoneAwareAttributes" in base) {
      base.timeZoneAwareAttributes = cfg.awareAttributes;
    }
    if (cfg.awareTypes !== undefined && "timeZoneAwareTypes" in base) {
      base.timeZoneAwareTypes = cfg.awareTypes;
    }
    await fn();
  } finally {
    setDefaultTimezone(oldDefault);
    if ("timeZoneAwareAttributes" in base && oldAwareAttributes !== undefined) {
      base.timeZoneAwareAttributes = oldAwareAttributes;
    }
    if ("timeZoneAwareTypes" in base && oldAwareTypes !== undefined) {
      base.timeZoneAwareTypes = oldAwareTypes;
    }
  }
}
