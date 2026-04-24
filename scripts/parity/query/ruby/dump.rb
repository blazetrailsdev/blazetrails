#!/usr/bin/env ruby
# frozen_string_literal: true

# Usage (from repo root):
#   bundle exec --gemfile scripts/parity/schema/ruby/Gemfile \
#     ruby scripts/parity/query/ruby/dump.rb <fixture-dir> <out.json> \
#     [--frozen-at ISO8601_UTC]
#
# Applies <fixture-dir>/schema.sql to a fresh SQLite database, evaluates
# <fixture-dir>/query.rb, calls to_sql on the result, and writes a
# CanonicalQuery JSON to <out.json>.
#
# --frozen-at <iso> freezes time via ActiveSupport::Testing::TimeHelpers for
# deterministic time-dependent queries (e.g. 1.week.ago).

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
  warn "Usage: bundle exec ruby dump.rb <fixture-dir> <out.json> [--frozen-at ISO]"
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
      (warn "--frozen-at requires a value"; exit 1) unless val
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

# TimeHelper mixin — provides travel_to / travel_back
module TimeHelper
  include ActiveSupport::Testing::TimeHelpers
end
time_helper = Object.new.extend(TimeHelper)

Dir.mktmpdir("parity-query-ruby-") do |tmpdir|
  db_path = File.join(tmpdir, "query.db")

  begin
    # 1. Apply schema.sql to a fresh temp SQLite file
    SQLite3::Database.new(db_path) do |db|
      db.execute_batch(File.read(File.join(fixture_dir, "schema.sql")))
    end

    # 2. Connect via ActiveRecord
    ActiveRecord::Base.establish_connection(adapter: "sqlite3", database: db_path)
    conn = ActiveRecord::Base.connection

    # 3. Freeze time if requested (activesupport travel_to)
    time_helper.travel_to(Time.parse(frozen_at)) if frozen_at

    # 4. Evaluate query.rb — last expression is the Arel node/manager to dump
    query_source = File.read(File.join(fixture_dir, "query.rb"))
    # rubocop:disable Security/Eval
    result = eval(query_source)
    # rubocop:enable Security/Eval
    raise "[#{fixture_name}] query.rb returned nil" if result.nil?

    # 5. Get SQL and binds.
    #    - Arel::TreeManager (SelectManager etc.) and Arel::Nodes::Node both expose
    #      to_sql(engine) in Rails 8.0 (arel/tree_manager.rb:53, arel/nodes/node.rb:148).
    #    - Binds are extracted via conn.to_sql_and_binds when the result is a manager.
    sql_str, binds = if result.respond_to?(:ast)
      # Manager (SelectManager etc.) — pass the whole manager for bind extraction.
      # connection#to_sql_and_binds accepts an Arel manager or SQL string.
      raw_sql, raw_binds = conn.to_sql_and_binds(result)
      [raw_sql.strip, raw_binds.map { |b| b.value.to_s }]
    elsif result.respond_to?(:to_sql)
      # Plain node (Attribute, predicate, etc.) — Arel::Nodes::Node#to_sql
      # (arel/nodes/node.rb:148) uses the visitor with the connection's engine.
      [result.to_sql.strip, []]
    else
      raise "[#{fixture_name}] query.rb returned #{result.class}: expected an Arel node or manager"
    end

    frozen_ts = frozen_at || Time.now.utc.iso8601(3)

    # 6. Write CanonicalQuery JSON
    canonical = {
      "version"  => 1,
      "fixture"  => fixture_name,
      "frozenAt" => frozen_ts,
      "sql"      => sql_str,
      "binds"    => binds,
    }

    FileUtils.mkdir_p(File.dirname(out_path))
    File.write(out_path, JSON.pretty_generate(canonical) + "\n")

    # Verbose output for debugging in CI logs
    puts "[rails] #{fixture_name}"
    puts "  result type : #{result.class}"
    puts "  sql         : #{sql_str}"
    puts "  binds (#{binds.length})  : #{binds.inspect}" unless binds.empty?
    puts "  frozenAt    : #{frozen_ts}"
    puts "  → #{out_path}"

  ensure
    time_helper.travel_back if frozen_at
    begin
      ActiveRecord::Base.remove_connection
    rescue StandardError
      # already removed or never opened
    end
  end
end
