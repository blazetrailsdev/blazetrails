/**
 * Shared `edit` flow for the `credentials` and `encrypted` commands.
 *
 * Ports `Rails::Command::Helpers::Editor` and the bookkeeping wrapped around
 * it in `CredentialsCommand#edit` / `EncryptedCommand#edit` — generate a key
 * file if missing, open the decrypted contents in `$VISUAL`/`$EDITOR`, then
 * re-encrypt.
 *
 * Documented divergences from Rails:
 *
 * - **No `.gitignore` editing.** Rails' `EncryptionKeyFileGenerator` also
 *   appends the key path to `.gitignore`; we don't, yet (follow-up).
 * - **No `validate!` warning.** Rails warns when re-encrypted content fails
 *   YAML parsing via `EncryptedConfiguration#validate!`. That helper isn't
 *   ported yet (PR 1.6-pre-b).
 * - **EDITOR split is whitespace, not Shellwords.** Quoted editor commands
 *   like `VISUAL='code --wait'` work; embedded escapes do not.
 */

import { EncryptedFile, MissingKeyError } from "@blazetrails/activesupport/encrypted-file";
import { getFsAsync } from "@blazetrails/activesupport/fs-adapter";
import { getChildProcessAsync } from "@blazetrails/activesupport/child-process-adapter";
import { env, stdout } from "@blazetrails/activesupport/process-adapter";

export interface EditOptions {
  generateKeyIfMissing: boolean;
}

function pickEditor(): string | null {
  const visual = env.VISUAL;
  if (visual && visual.length > 0) return visual;
  const editor = env.EDITOR;
  if (editor && editor.length > 0) return editor;
  return null;
}

function displayEditorHint(): void {
  stdout.write("No $VISUAL or $EDITOR to open file in. Assign one like this:\n");
  stdout.write('\n  VISUAL="code --wait" trails credentials edit\n\n');
  stdout.write("For editors that fork and exit immediately, it's important to pass a wait flag;\n");
  stdout.write("otherwise, the file will be saved immediately with no chance to edit.\n");
}

async function ensureKeyFile(file: EncryptedFile): Promise<void> {
  // Read fs directly rather than calling `file.isKey()`, which memoizes
  // the (negative) result and would prevent the freshly-written key from
  // being seen later in this same edit pass. Env-var keys still win at
  // read time, so checking the file alone is fine.
  const fs = await getFsAsync();
  if (await fs.exists!(file.keyPath)) return;
  const key = EncryptedFile.generateKey();
  await fs.writeFile!(file.keyPath, `${key}\n`, { mode: 0o600 });
}

export async function editEncryptedFile(file: EncryptedFile, opts: EditOptions): Promise<void> {
  if (opts.generateKeyIfMissing) {
    try {
      await ensureKeyFile(file);
    } catch (e) {
      stdout.write(`Failed to create key file at ${file.keyPath}: ${(e as Error).message}\n`);
      return;
    }
  }

  const editor = pickEditor();
  if (editor === null) {
    displayEditorHint();
    return;
  }

  const cp = await getChildProcessAsync();
  const [cmd, ...args] = editor.split(/\s+/).filter((p) => p.length > 0);
  if (!cmd) {
    displayEditorHint();
    return;
  }

  try {
    await file.change(async (tmpPath) => {
      stdout.write(`Editing ${file.contentPath}...\n`);
      const result = cp.spawnSync(cmd, [...args, tmpPath]);
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`Editor exited with status ${result.status ?? "<signal>"}`);
      }
    });
    stdout.write("File encrypted and saved.\n");
  } catch (e) {
    if (e instanceof MissingKeyError) {
      stdout.write(`${e.message}\n`);
      return;
    }
    stdout.write(`Couldn't decrypt ${file.contentPath}. Perhaps you passed the wrong key?\n`);
  }
}
