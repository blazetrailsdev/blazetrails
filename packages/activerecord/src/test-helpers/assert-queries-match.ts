/**
 * Mirrors Rails' `ActiveRecord::Assertions::QueryAssertions` test helpers from
 * activerecord/lib/active_record/testing/query_assertions.rb — specifically the
 * `SQLCounter` instrumentation subscriber and `assert_queries_match`:
 *
 *   class SQLCounter
 *     attr_reader :log_full, :log_all
 *     def initialize; @log_full = []; @log_all = []; end
 *     def log; @log_full.map(&:first); end
 *     def call(*, payload)
 *       return if payload[:cached]
 *       sql = payload[:sql]
 *       @log_all << sql
 *       unless payload[:name] == "SCHEMA"
 *         bound_values = (payload[:binds] || []).map { |v|
 *           v = v.value_for_database if v.respond_to?(:value_for_database); v
 *         }
 *         @log_full << [sql, bound_values]
 *       end
 *     end
 *   end
 *
 *   def assert_queries_match(match, count: nil, include_schema: false, &block)
 *     ActiveRecord::Base.lease_connection.materialize_transactions
 *     counter = SQLCounter.new
 *     ActiveSupport::Notifications.subscribed(counter, "sql.active_record") do
 *       result = ...block...
 *       queries = include_schema ? counter.log_all : counter.log
 *       matched_queries = queries.select { |q| match === q }
 *       count ? assert_equal(count, matched_queries.size) : assert(matched_queries.size >= 1)
 *       result
 *     end
 *   end
 *
 * The trails port subscribes to the `sql.active_record` notification channel,
 * collects non-SCHEMA queries (filtering out cached ones), and asserts that at
 * least one (or exactly `count`) match a regex or string. Because trails queries
 * are async, the block may return a promise and the helper is async.
 */

import { Notifications, type NotificationEvent } from "@blazetrails/activesupport";
import { Base } from "../base.js";

/** Mirrors Rails `SQLCounter` — accumulates `sql.active_record` payloads. */
export class SQLCounter {
  /** Rails `@log_full`: `[sql, boundValues]` pairs, excluding SCHEMA queries. */
  readonly logFull: Array<[string, unknown[]]> = [];

  /** Rails `@log_all`: every non-cached SQL string, SCHEMA included. */
  readonly logAll: string[] = [];

  /** Rails `log` — the SQL of every non-SCHEMA query. */
  get log(): string[] {
    return this.logFull.map(([sql]) => sql);
  }

  /** Notification subscriber. Mirrors Rails `SQLCounter#call(*, payload)`. */
  call = (event: NotificationEvent): void => {
    const payload = event.payload as {
      cached?: unknown;
      sql?: string;
      name?: string;
      binds?: unknown[];
    };
    if (payload.cached) return;

    const sql = payload.sql ?? "";
    this.logAll.push(sql);

    if (payload.name !== "SCHEMA") {
      const boundValues = (payload.binds ?? []).map((value) => {
        if (
          value != null &&
          typeof (value as { valueForDatabase?: unknown }).valueForDatabase === "function"
        ) {
          return (value as { valueForDatabase: () => unknown }).valueForDatabase();
        }
        return value;
      });
      this.logFull.push([sql, boundValues]);
    }
  };
}

export interface AssertQueriesMatchOptions {
  /** Assert exactly this many matching queries instead of "at least one". */
  count?: number;
  /** Include SCHEMA queries (Rails `include_schema`). */
  includeSchema?: boolean;
}

/** Ruby `match === query`: regex match for a RegExp, equality for a string. */
function queryMatches(match: string | RegExp, query: string): boolean {
  return typeof match === "string" ? match === query : match.test(query);
}

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

/**
 * Asserts that the SQL queries executed in `block` match `match`.
 *
 *   await assertQueriesMatch(/LIMIT \?/, () => Post.first());
 *   await assertQueriesMatch(/LIMIT \?/, { count: 1 }, () => Post.first());
 *
 * Mirrors Rails `assert_queries_match`. The `block` may be sync or async; its
 * resolved value is returned.
 */
export async function assertQueriesMatch<T>(
  match: string | RegExp,
  optionsOrBlock: AssertQueriesMatchOptions | (() => T | Promise<T>),
  maybeBlock?: () => T | Promise<T>,
): Promise<T> {
  const options: AssertQueriesMatchOptions =
    typeof optionsOrBlock === "function" ? {} : optionsOrBlock;
  const block = typeof optionsOrBlock === "function" ? optionsOrBlock : maybeBlock;
  if (!block) {
    throw new TypeError("assertQueriesMatch requires a block");
  }

  await Base.leaseConnection().materializeTransactions?.();

  const counter = new SQLCounter();
  const subscription = Notifications.subscribe("sql.active_record", counter.call);
  try {
    const result = await block();

    const queries = options.includeSchema ? counter.logAll : counter.log;
    const matchedQueries = queries.filter((query) => queryMatches(match, query));

    const queryList = queries.length ? `\nQueries:\n${queries.join("\n")}` : "";
    if (options.count != null) {
      if (matchedQueries.length !== options.count) {
        throw new AssertionError(
          `${matchedQueries.length} instead of ${options.count} queries were executed.${queryList}`,
        );
      }
    } else if (matchedQueries.length < 1) {
      throw new AssertionError(`1 or more queries expected, but none were executed.${queryList}`);
    }

    return result;
  } finally {
    Notifications.unsubscribe(subscription);
  }
}

/**
 * Asserts that no SQL queries matching `match` are executed in `block`.
 * Mirrors Rails `assert_no_queries_match` (`count: 0`).
 */
export async function assertNoQueriesMatch<T>(
  match: string | RegExp,
  optionsOrBlock: Omit<AssertQueriesMatchOptions, "count"> | (() => T | Promise<T>),
  maybeBlock?: () => T | Promise<T>,
): Promise<T> {
  const options: AssertQueriesMatchOptions =
    typeof optionsOrBlock === "function" ? {} : optionsOrBlock;
  const block = typeof optionsOrBlock === "function" ? optionsOrBlock : maybeBlock;
  if (!block) {
    throw new TypeError("assertNoQueriesMatch requires a block");
  }
  return assertQueriesMatch(match, { ...options, count: 0 }, block);
}
