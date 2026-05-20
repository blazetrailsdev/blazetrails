import { describe, expect, test, beforeEach } from "vitest";
import { BacktraceCleaner } from "./backtrace-cleaner.js";

describe("BacktraceCleaner", () => {
  let cleaner: BacktraceCleaner;

  beforeEach(() => {
    cleaner = new BacktraceCleaner();
  });

  test("#clean should consider traces from irb lines as User code", () => {
    const backtrace = [
      "(irb):1",
      "/Path/to/rails/railties/lib/rails/commands/console.rb:77:in `start'",
      "bin/rails:4:in `<main>'",
    ];
    const result = cleaner.clean(backtrace);
    expect(result[0]).toBe("(irb):1");
    expect(result.length).toBe(1);
  });

  test("#clean should show relative paths", () => {
    const backtrace = [
      "./test/backtrace_cleaner_test.rb:123",
      "/Path/to/rails/activesupport/some_testing_file.rb:42:in `test'",
      "bin/rails:4:in `<main>'",
    ];
    const result = cleaner.clean(backtrace);
    expect(result[0]).toBe("./test/backtrace_cleaner_test.rb:123");
    expect(result.length).toBe(1);
  });

  test("#clean should consider traces that include dasherized Rails application name", () => {
    const backtrace = [
      "(my-app):1",
      "/Path/to/rails/railties/lib/rails/commands/console.rb:77:in `start'",
      "bin/rails:4:in `<main>'",
    ];
    const result = cleaner.clean(backtrace);
    expect(result[0]).toBe("(my-app):1");
    expect(result.length).toBe(1);
  });

  test("#clean should omit ActionView template methods names", () => {
    const backtrace = [
      "app/views/application/index.html.erb:4:in `block in _app_views_application_index_html_erb__1234_5678'",
    ];
    const result = cleaner.clean(backtrace);
    expect(result[0]).toBe("app/views/application/index.html.erb:4");
  });

  test("#clean should omit ActionView template methods names on Ruby 3.4+", () => {
    const backtrace = [
      "app/views/application/index.html.erb:4:in 'block in _app_views_application_index_html_erb__1234_5678'",
    ];
    const result = cleaner.clean(backtrace);
    expect(result[0]).toBe("app/views/application/index.html.erb:4");
  });

  test("setRoot strips application root from absolute paths", () => {
    cleaner.setRoot("/my/app");
    const result = cleaner.clean(["/my/app/app/models/user.rb:10"]);
    expect(result[0]).toBe("app/models/user.rb:10");
  });
});
