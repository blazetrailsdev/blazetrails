import { describe, it, expect } from "vitest";
import { createProgram } from "../cli.js";

describe("CredentialsCommand", () => {
  const cmd = () => createProgram().commands.find((c) => c.name() === "credentials");

  it("is registered with edit and show subcommands", () => {
    const names = cmd()?.commands.map((c) => c.name()) ?? [];
    expect(names).toEqual(expect.arrayContaining(["edit", "show"]));
  });

  it("edit accepts --environment", () => {
    const edit = cmd()?.commands.find((c) => c.name() === "edit");
    expect(edit?.options.find((o) => o.long === "--environment")).toBeDefined();
  });
});
