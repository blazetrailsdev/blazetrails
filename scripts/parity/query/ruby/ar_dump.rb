#!/usr/bin/env ruby
# frozen_string_literal: true

# Usage (from repo root):
#   bundle exec --gemfile scripts/parity/schema/ruby/Gemfile \
#     ruby scripts/parity/query/ruby/ar_dump.rb <fixture-dir> <out.json> \
#     [--frozen-at ISO8601_UTC_Z]
#
# Like scripts/parity/query/ruby/dump.rb but tailored to ActiveRecord
# query fixtures: applies <fixture-dir>/schema.sql, establishes an AR
# connection, loads <fixture-dir>/models.rb (class definitions +
# associations), evaluates <fixture-dir>/query.rb against them, and
# writes a CanonicalQuery JSON with the SQL the terminal relation
# produces via `.to_sql`.
#
# Time is always frozen for deterministic query evaluation. --frozen-at
# pins the timestamp to a specific ISO 8601 UTC value (trailing Z
# required); omitting it uses 2000-01-01T00:00:00.000Z.

require "bundler/setup"
require "active_record"
require "active_support"
require "active_support/core_ext/integer/time"
require "active_support/testing/time_helpers"
require "sqlite3"
require "tmpdir"
require "json"
require "fileutils"
require "time"

def usage
  warn "Usage: bundle exec --gemfile scripts/parity/schema/ruby/Gemfile ruby scripts/parity/query/ruby/ar_dump.rb <fixture-dir> <out.json> [--frozen-at ISO8601_UTC_Z]"
  exit 1
end

def parse_args(argv)
  fixture_dir = nil
  out_path    = nil
  frozen_at   = nil
  i = 0
  while i < argv.length
    case argv[i]
    when "--frozen-at"
      i += 1
      val = argv[i]
      if val.nil? || val.start_with?("--")
        warn "--frozen-at requires a value"
        exit 1
      end
      frozen_at = val
    else
      if fixture_dir.nil?
        fixture_dir = argv[i]
      elsif out_path.nil?
        out_path = argv[i]
      else
        warn "unexpected argument: #{argv[i]}"
        usage
      end
    end
    i += 1
  end
  usage unless fixture_dir && out_path
  [File.expand_path(fixture_dir), File.expand_path(out_path), frozen_at]
end

fixture_dir, out_path, frozen_at = parse_args(ARGV)
fixture_name = File.basename(fixture_dir)

frozen_time = if frozen_at
  unless frozen_at.match?(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z\z/)
    warn "--frozen-at must be ISO 8601 UTC with trailing Z (e.g. 2026-01-01T00:00:00.000Z)"
    exit 1
  end
  Time.iso8601(frozen_at).utc
else
  Time.utc(2000, 1, 1)
end
frozen_ts = frozen_at || frozen_time.iso8601(3)

module TimeHelper
  include ActiveSupport::Testing::TimeHelpers
end
time_helper = Object.new.extend(TimeHelper)

Dir.mktmpdir("parity-ar-ruby-") do |tmpdir|
  db_path = File.join(tmpdir, "query.db")

  begin
    # 1. Apply schema.sql to a fresh temp SQLite file.
    SQLite3::Database.new(db_path) do |db|
      db.execute_batch(File.read(File.join(fixture_dir, "schema.sql")))
    end

    # 2. Connect AR — models.rb's class definitions inherit from
    #    ActiveRecord::Base which reads the current connection at eval.
    ActiveRecord::Base.establish_connection(adapter: "sqlite3", database: db_path)

    # 3. Freeze time before loading fixture code in case a model uses
    #    Time.current in a default scope or a class-level filter.
    time_helper.travel_to(frozen_time)

    # 4. Load models.rb first, then evaluate query.rb. Both go through the
    #    same isolated binding so class constants set by models.rb are
    #    visible to query.rb (they land on TOPLEVEL via class keyword).
    query_context = Object.new
    query_binding = query_context.instance_eval { binding }

    models_path = File.join(fixture_dir, "models.rb")
    if File.exist?(models_path)
      models_source = File.read(models_path)
      # rubocop:disable Security/Eval
      eval(models_source, query_binding, models_path)
      # rubocop:enable Security/Eval
    end

    query_path   = File.join(fixture_dir, "query.rb")
    query_source = File.read(query_path)
    # rubocop:disable Security/Eval
    result = eval(query_source, query_binding, query_path)
    # rubocop:enable Security/Eval
    raise "[#{fixture_name}] query.rb returned nil" if result.nil?
    unless result.respond_to?(:to_sql)
      raise "[#{fixture_name}] query.rb returned #{result.class}: expected an AR relation / Arel manager responding to #to_sql"
    end

    # 5. Extract SQL — two forms:
    #    a) Inlined (sql): to_sql() with all values embedded as literals.
    #    b) Parameterized (paramSql + binds): build both from the same Arel
    #       Collectors::Bind pass so paramSql and binds stay in sync.
    #       Only datetime values become ? placeholders; other scalars are
    #       re-inlined so ? count = binds.length (mirrors trails' approach).
    #       Falls back to bound_attributes if the Arel collector finds no binds.
    sql_str = result.to_sql.strip
    binds = []
    param_sql = sql_str

    if result.respond_to?(:arel)
      begin
        arel_obj = result.arel
        conn = ActiveRecord::Base.connection
        visitor = conn.visitor

        # Composite gives us the full placeholder SQL string (SQLString) and
        # the raw bind list (Bind) in one pass. Using Bind alone doesn't
        # accumulate SQL fragments, so parts.join would not produce usable SQL.
        sql_collector  = Arel::Collectors::SQLString.new
        bind_collector = Arel::Collectors::Bind.new
        collector = Arel::Collectors::Composite.new(sql_collector, bind_collector)
        visitor.accept(arel_obj.ast, collector)

        placeholder_sql = sql_collector.value.to_s.strip
        bind_values     = bind_collector.value
        bind_index      = 0

        rebuilt_sql = placeholder_sql.gsub("?") do
          bind = bind_values[bind_index]
          bind_index += 1

          val =
            if bind.respond_to?(:value_for_database)
              bind.value_for_database
            elsif bind.respond_to?(:value)
              bind.value.respond_to?(:value_for_database) ? bind.value.value_for_database : bind.value
            else
              bind
            end

          if val.respond_to?(:utc)
            binds << val.utc.iso8601(3)
            "?"
          else
            conn.quote(val)
          end
        end

        param_sql = binds.any? ? rebuilt_sql : sql_str
      rescue NoMethodError
        # Arel collectors don't implement all collector methods in every
        # Rails version (e.g. preparable= in Rails 8.0). Fall back to
        # bound_attributes below.
        binds = []
        param_sql = sql_str
      end
    end

    # Fallback via bound_attributes when the Arel collector produced no datetime binds.
    # Only apply when the fallback binds sync with param_sql's placeholder count so
    # paramSql and binds never diverge (param_sql defaults to sql_str which has no ?).
    if binds.empty? && result.respond_to?(:bound_attributes)
      fallback_binds = result.bound_attributes.filter_map do |ba|
        val = ba.value_for_database
        val.utc.iso8601(3) if val.respond_to?(:utc)
      end
      placeholder_count = param_sql.count("?")
      binds = fallback_binds if fallback_binds.any? && placeholder_count == fallback_binds.length
    end

    # 6. Write CanonicalQuery JSON
    canonical = {
      "version"  => 1,
      "fixture"  => fixture_name,
      "frozenAt" => frozen_ts,
      "sql"      => sql_str,
      "paramSql" => param_sql,
      "binds"    => binds,
    }

    FileUtils.mkdir_p(File.dirname(out_path))
    File.write(out_path, JSON.pretty_generate(canonical) + "\n")

    puts "[rails] #{fixture_name}"
    puts "  result type : #{result.class}"
    puts "  sql         : #{sql_str}"
    puts "  frozenAt    : #{frozen_ts}"
    puts "  → #{out_path}"

  ensure
    time_helper.travel_back
    begin
      ActiveRecord::Base.remove_connection
    rescue StandardError
      # already removed or never opened
    end
  end
end
