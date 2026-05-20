import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { GeneratorBase } from "./base.js";

class TestGenerator extends GeneratorBase {}

let tmpDir: string;
let lines: string[];
let gen: TestGenerator;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trails-actions-"));
  lines = [];
  gen = new TestGenerator({ cwd: tmpDir, output: (m) => lines.push(m) });
});

afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const read = (name: string) => fs.readFileSync(path.join(tmpDir, name), "utf-8");

function seed(name: string, body: string) {
  fs.mkdirSync(path.dirname(path.join(tmpDir, name)), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, name), body);
}

describe("ActionsTest", () => {
  it("gem should put gem dependency in gemfile", () => {
    gen.gem("will-paginate");
    expect(read("Gemfile")).toMatch(/gem "will-paginate"\n$/);
  });

  it("gem with version should include version in gemfile", () => {
    gen.gem("rspec", ">= 2.0.0.a5");
    gen.gem("RedCloth", ">= 4.1.0", "< 4.2.0");
    gen.gem("nokogiri", { version: ">= 1.4.2" });
    gen.gem("faker", { version: [">= 0.1.0", "< 0.3.0"] });
    const c = read("Gemfile");
    expect(c).toMatch(/gem "rspec", ">= 2\.0\.0\.a5"/);
    expect(c).toMatch(/gem "RedCloth", ">= 4\.1\.0", "< 4\.2\.0"/);
    expect(c).toMatch(/gem "nokogiri", ">= 1\.4\.2"/);
    expect(c).toMatch(/gem "faker", ">= 0\.1\.0", "< 0\.3\.0"/);
  });

  it("gem should include options", () => {
    gen.gem("rspec", { github: "dchelimsky/rspec", require: false });
    expect(read("Gemfile")).toMatch(/^gem "rspec", github: "dchelimsky\/rspec", require: false$/m);
  });

  it("gem should support multiline comments", () => {
    gen.gem("rspec", { comment: "Use RSpec\nReplaces minitest" });
    expect(read("Gemfile")).toMatch(/# Use RSpec\n# Replaces minitest\ngem "rspec"/);
  });

  it("gem with gemfile without newline at the end", () => {
    seed("Gemfile", 'gem "rspec-rails"');
    gen.gem("will-paginate");
    expect(read("Gemfile")).toMatch(/gem "rspec-rails"\ngem "will-paginate"\n$/);
  });

  it("route should add route", () => {
    seed("config/routes.rb", "App.routes.draw do\nend\n");
    gen.route('root "welcome#index"');
    expect(read("config/routes.rb")).toContain('root "welcome#index"');
  });

  it("route with namespace option should nest route", () => {
    seed("config/routes.rb", "App.routes.draw do\nend\n");
    gen.route('root "admin#index"', { namespace: "admin" });
    const c = read("config/routes.rb");
    expect(c).toContain("namespace :admin do");
    expect(c).toContain('root "admin#index"');
  });

  it("environment should include data in environment initializer block", () => {
    seed("config/application.rb", "class Application < Rails::Application\nend\n");
    gen.environment('config.asset_host = "cdn.example.com"');
    expect(read("config/application.rb")).toContain('config.asset_host = "cdn.example.com"');
  });

  it("environment should include data in environment initializer block with env option", () => {
    seed("config/environments/development.rb", "Rails.application.configure do\nend\n");
    gen.environment('config.asset_host = "localhost:3000"', { env: "development" });
    expect(read("config/environments/development.rb")).toContain(
      'config.asset_host = "localhost:3000"',
    );
  });

  it("generate should queue a sub-generator invocation", () => {
    gen.generate("scaffold", "Post", "title:string", "body:text");
    expect(gen.pendingGenerators).toEqual([
      { what: "scaffold", args: ["Post", "title:string", "body:text"] },
    ]);
    expect(lines.some((l) => l.includes("generate") && l.includes("scaffold"))).toBe(true);
  });
});
