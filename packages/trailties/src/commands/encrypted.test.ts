import { describe, it, expect } from "vitest";
import { createProgram } from "../cli.js";

describe("EncryptedCommand", () => {
  const cmd = () => createProgram().commands.find((c) => c.name() === "encrypted");

  it("is registered with edit and show subcommands", () => {
    const names = cmd()?.commands.map((c) => c.name()) ?? [];
    expect(names).toEqual(expect.arrayContaining(["edit", "show"]));
  });

  it("edit defaults --key to config/master.key", () => {
    const edit = cmd()?.commands.find((c) => c.name() === "edit");
    const opt = edit?.options.find((o) => o.long === "--key");
    expect(opt?.defaultValue).toBe("config/master.key");
  });
});
