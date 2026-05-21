import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AuthenticationGenerator } from "./authentication-generator.js";

let tmpDir: string;
const join = (...p: string[]) => path.join(tmpDir, ...p);
const exists = (p: string) => fs.existsSync(join(p));

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trails-auth-"));
  fs.mkdirSync(join("app/controllers"), { recursive: true });
  fs.mkdirSync(join("config"), { recursive: true });
  const ac = "class ApplicationController < ActionController::Base\nend\n";
  fs.writeFileSync(join("app/controllers/application_controller.rb"), ac);
  fs.writeFileSync(join("config/routes.rb"), "Rails.application.routes.draw do\nend\n");
});
afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

function run(api = false) {
  new AuthenticationGenerator({ cwd: tmpDir, output: () => {}, api }).run();
}

describe("AuthenticationGeneratorTest", () => {
  it("authentication_generator", () => {
    fs.mkdirSync(join("app/channels/application_cable"), { recursive: true });
    run();
    expect(exists("app/channels/application_cable/connection.rb")).toBe(true);
    for (const p of [
      "app/models/user.rb",
      "app/models/current.rb",
      "app/models/session.rb",
      "app/controllers/sessions_controller.rb",
      "app/controllers/passwords_controller.rb",
      "app/controllers/concerns/authentication.rb",
      "app/mailers/passwords_mailer.rb",
      "app/views/passwords_mailer/reset.html.erb",
      "app/views/passwords_mailer/reset.text.erb",
      "test/mailers/previews/passwords_mailer_preview.rb",
    ]) {
      expect(exists(p)).toBe(true);
    }
    const appCtrl = fs.readFileSync(join("app/controllers/application_controller.rb"), "utf-8");
    const [classLine, includesLine] = appCtrl.split("\n");
    expect(classLine).toBe("class ApplicationController < ActionController::Base");
    expect(includesLine).toBe("  include Authentication");
    const routes = fs.readFileSync(join("config/routes.rb"), "utf-8");
    expect(routes).toBe(
      "Rails.application.routes.draw do\n  resources :passwords, param: :token\n  resource :session\nend\n",
    );
  });

  it("configure_is_a_noop_when_target_files_are_missing", () => {
    fs.rmSync(join("app/controllers/application_controller.rb"));
    fs.rmSync(join("config/routes.rb"));
    expect(() => run()).not.toThrow();
  });

  it("authentication_generator_with_api_flag", () => {
    run(true);
    expect(exists("app/models/user.rb")).toBe(true);
    expect(exists("app/views/sessions/new.html.erb")).toBe(false);
  });

  it("connection_class_skipped_without_action_cable", () => {
    run();
    expect(exists("app/channels/application_cable/connection.rb")).toBe(false);
  });

  it.skip("authentication_generator_without_bcrypt_in_gemfile", () => {});
  it.skip("model_test_is_skipped_if_test_framework_is_given", () => {});
});
