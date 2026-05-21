import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EncryptedFile } from "@blazetrails/activesupport/encrypted-file";
import { getFsAsync, getPathAsync } from "@blazetrails/activesupport/fs-adapter";
import { getOsAsync } from "@blazetrails/activesupport";
import { setEnv } from "@blazetrails/activesupport/process-adapter";
import {
  registerChildProcessAdapter,
  childProcessAdapterConfig,
  type ChildProcessAdapter,
} from "@blazetrails/activesupport/child-process-adapter";
import { editEncryptedFile } from "./encrypted-file-editor.js";

describe("editEncryptedFile", () => {
  let tmpdir: string;
  let contentPath: string;
  let keyPath: string;
  let savedVisual: string | undefined;
  let savedEditor: string | undefined;
  let savedAdapter: string | null;

  beforeEach(async () => {
    const fs = await getFsAsync();
    const path = await getPathAsync();
    const os = await getOsAsync();
    tmpdir = await fs.mkdtemp!(`${os.tmpdir()}${path.sep}enc-editor-test-`);
    contentPath = path.join(tmpdir, "secret.yml.enc");
    keyPath = path.join(tmpdir, "secret.key");
    savedVisual = process.env.VISUAL;
    savedEditor = process.env.EDITOR;
    savedAdapter = childProcessAdapterConfig.adapter;
    setEnv("VISUAL", undefined);
    setEnv("EDITOR", undefined);
  });

  afterEach(async () => {
    const fs = await getFsAsync();
    try {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    } catch {
      /* */
    }
    setEnv("VISUAL", savedVisual);
    setEnv("EDITOR", savedEditor);
    childProcessAdapterConfig.adapter = savedAdapter;
  });

  function build(): EncryptedFile {
    return new EncryptedFile({
      contentPath,
      keyPath,
      envKey: "ENC_EDITOR_TEST_KEY",
      raiseIfMissingKey: true,
    });
  }

  function registerFakeEditor(write: string | null): { calls: string[][] } {
    const calls: string[][] = [];
    const adapter: ChildProcessAdapter = {
      spawnSync(cmd, args) {
        calls.push([cmd, ...args]);
        if (write !== null) {
          const tmp = args[args.length - 1];
          // Synchronous write via the fs module the adapter uses (Node).
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const nodeFs = require("node:fs") as typeof import("node:fs");
          nodeFs.writeFileSync(tmp, write);
        }
        return { status: 0, signal: null, stdout: "", stderr: "" };
      },
    };
    registerChildProcessAdapter("fake-editor", adapter);
    childProcessAdapterConfig.adapter = "fake-editor";
    return { calls };
  }

  it("generates a key file on first edit when missing", async () => {
    setEnv("EDITOR", "fake-noop");
    registerFakeEditor("hello world\n");
    const file = build();
    await editEncryptedFile(file, { generateKeyIfMissing: true });
    const fs = await getFsAsync();
    expect(await fs.exists!(keyPath)).toBe(true);
    expect(await file.read()).toBe("hello world\n");
  });

  it("re-encrypts contents when editor writes changes", async () => {
    setEnv("EDITOR", "fake-noop");
    const fs = await getFsAsync();
    await fs.writeFile!(keyPath, EncryptedFile.generateKey());
    const file = build();
    await file.write("v1");
    registerFakeEditor("v2");
    await editEncryptedFile(file, { generateKeyIfMissing: false });
    expect(await file.read()).toBe("v2");
  });

  it("invokes the editor with extra args split on whitespace", async () => {
    setEnv("VISUAL", "code --wait");
    const fs = await getFsAsync();
    await fs.writeFile!(keyPath, EncryptedFile.generateKey());
    const { calls } = registerFakeEditor("ok");
    await editEncryptedFile(build(), { generateKeyIfMissing: false });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("code");
    expect(calls[0][1]).toBe("--wait");
  });

  it("does nothing when neither $VISUAL nor $EDITOR is set", async () => {
    const fs = await getFsAsync();
    await fs.writeFile!(keyPath, EncryptedFile.generateKey());
    const { calls } = registerFakeEditor("nope");
    await editEncryptedFile(build(), { generateKeyIfMissing: false });
    expect(calls).toHaveLength(0);
    expect(await fs.exists!(contentPath)).toBe(false);
  });
});
