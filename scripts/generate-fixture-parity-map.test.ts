import { describe, it, expect } from "vitest";
import { mapSource } from "./generate-fixture-parity-map.js";

describe("mapSource — fixtures are scoped per declaring class", () => {
  it("does not leak fixtures from one class onto tests in sibling classes", () => {
    // Mirrors tasks/database_tasks_test.rb: `fixtures :courses, :colleges`
    // lives in ONE nested class; no test calls a `courses(`/`colleges(`
    // accessor. The other class's tests must NOT be marked.
    const src = `
module ActiveRecord
  class TruncateTest < ActiveRecord::TestCase
    fixtures :courses, :colleges

    def test_truncate_tables
      assert_equal 0, Course.count
    end
  end

  class RegisterTaskTest < ActiveRecord::TestCase
    def test_register_task
      assert_equal handler, resolve("sqlite3")
    end

    def test_unregistered_task
      assert_nil resolve("nope")
    end
  end
end
`;
    expect(mapSource(src)).toEqual(["truncate tables"]);
  });

  it("returns empty when no class declares fixtures", () => {
    const src = `
class PlainTest < ActiveRecord::TestCase
  def test_one
    assert true
  end
end
`;
    expect(mapSource(src)).toEqual([]);
  });

  it("marks only accessor-using tests when an accessor is referenced (precise)", () => {
    const src = `
class CustomerTest < ActiveRecord::TestCase
  fixtures :customers

  def test_uses_fixture
    assert customers(:david)
  end

  def test_ignores_fixture
    assert_equal 1, 1
  end
end
`;
    expect(mapSource(src)).toEqual(["uses fixture"]);
  });

  it("falls back to marking every candidate when no accessor is referenced", () => {
    const src = `
class CustomerTest < ActiveRecord::TestCase
  fixtures :customers

  def test_a
    assert Customer.count > 0
  end

  def test_b
    assert true
  end
end
`;
    expect(mapSource(src)).toEqual(["a", "b"]);
  });

  it("inherits fixtures from an in-file superclass", () => {
    const src = `
class BaseTruncateTest < ActiveRecord::TestCase
  fixtures :courses

  def test_base
    assert_equal 0, Course.count
  end
end

class PrefixedTruncateTest < BaseTruncateTest
  def test_prefixed
    assert true
  end
end
`;
    expect(mapSource(src).sort()).toEqual(["base", "prefixed"]);
  });

  it("handles multi-line fixture lists", () => {
    const src = `
class WideTest < ActiveRecord::TestCase
  fixtures :authors,
    :posts,
    :comments

  def test_wide
    assert posts(:welcome)
  end
end
`;
    expect(mapSource(src)).toEqual(["wide"]);
  });

  it('supports the `test "..." do` block form', () => {
    const src = `
class BlockTest < ActiveRecord::TestCase
  fixtures :topics

  test "block style test" do
    assert Topic.count >= 0
  end
end
`;
    expect(mapSource(src)).toEqual(["block style test"]);
  });
});
