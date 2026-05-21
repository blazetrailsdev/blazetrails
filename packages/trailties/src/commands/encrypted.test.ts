import { describe, it, expect } from "vitest";
import { createProgram } from "../cli.js";

describe("EncryptedCommand", () => {
  it("is registered on the program", () => {
    const program = createProgram();
    expect(program.commands.some((c) => c.name() === "encrypted")).toBe(true);
  });

  it("has edit and show subcommands", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "encrypted");
    const names = cmd?.commands.map((c) => c.name()) ?? [];
    expect(names).toEqual(expect.arrayContaining(["edit", "show"]));
  });

  it("edit accepts --key with default config/master.key", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "encrypted");
    const edit = cmd?.commands.find((c) => c.name() === "edit");
    const opt = edit?.options.find((o) => o.long === "--key");
    expect(opt).toBeDefined();
    expect(opt?.defaultValue).toBe("config/master.key");
  });
});
