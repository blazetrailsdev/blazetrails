import { describe, it, expect } from "vitest";
import { createProgram } from "../cli.js";

describe("CredentialsCommand", () => {
  it("is registered on the program", () => {
    const program = createProgram();
    expect(program.commands.some((c) => c.name() === "credentials")).toBe(true);
  });

  it("has edit and show subcommands", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "credentials");
    const names = cmd?.commands.map((c) => c.name()) ?? [];
    expect(names).toEqual(expect.arrayContaining(["edit", "show"]));
  });

  it("edit accepts --environment", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "credentials");
    const edit = cmd?.commands.find((c) => c.name() === "edit");
    const opt = edit?.options.find((o) => o.long === "--environment");
    expect(opt).toBeDefined();
  });
});
