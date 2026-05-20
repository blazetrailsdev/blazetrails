import { describe, it, expect } from "vitest";
import { correctTemplatePaths } from "./missing-corrections.js";
import { MissingTemplate } from "../lookup-context.js";

describe("correctTemplatePaths", () => {
  it("suggests near-match templates ranked by Jaro distance", () => {
    const candidates = [
      "users/index.html.erb",
      "users/show.html.erb",
      "users/edit.html.erb",
      "posts/show.html.erb",
    ];
    const result = correctTemplatePaths(candidates, "shwo", ["users"], false);
    expect(result[0]).toBe("users/show.html.erb");
  });

  it("returns [] when one of the prefix dirs already contains the exact basename", () => {
    const candidates = ["users/show.html.erb"];
    expect(correctTemplatePaths(candidates, "show.html.erb", ["users"], false)).toEqual([]);
  });

  it("filters by partial flag", () => {
    const candidates = ["users/show.html.erb", "users/_form.html.erb"];
    const forPartial = correctTemplatePaths(candidates, "frm", ["users"], true);
    expect(forPartial).toEqual(["users/form.html.erb"]); // underscore stripped per Rails
    const forFull = correctTemplatePaths(candidates, "shw", ["users"], false);
    expect(forFull).toEqual(["users/show.html.erb"]);
  });

  it("caps results at 6", () => {
    const candidates = Array.from({ length: 20 }, (_, i) => `users/page_${i}.html.erb`);
    const result = correctTemplatePaths(candidates, "page", ["users"], false);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it("returns [] when no candidates are known", () => {
    expect(correctTemplatePaths([], "show", ["users"], false)).toEqual([]);
  });
});

describe("MissingTemplate#corrections", () => {
  it("uses candidateTemplatePaths to suggest near matches", () => {
    const err = new MissingTemplate(
      "users",
      "shwo",
      "html",
      [],
      ["users/index.html.erb", "users/show.html.erb", "users/edit.html.erb"],
    );
    expect(err.corrections[0]).toBe("users/show.html.erb");
  });

  it("returns [] without a candidate list", () => {
    const err = new MissingTemplate("users", "shwo", "html", []);
    expect(err.corrections).toEqual([]);
  });

  it("memoises across reads", () => {
    const err = new MissingTemplate("users", "shwo", "html", [], ["users/show.html.erb"]);
    const first = err.corrections;
    expect(err.corrections).toBe(first);
  });
});
