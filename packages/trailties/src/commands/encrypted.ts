import { Command } from "commander";
import {
  EncryptedFile,
  MissingContentError,
  MissingKeyError,
} from "@blazetrails/activesupport/encrypted-file";
import { stdout, setExitCode } from "@blazetrails/activesupport/process-adapter";
import { editEncryptedFile } from "../encrypted-file-editor.js";

interface EncryptedOptions {
  key: string;
}

function buildFile(contentPath: string, opts: EncryptedOptions): EncryptedFile {
  return new EncryptedFile({
    contentPath,
    keyPath: opts.key,
    envKey: "RAILS_MASTER_KEY",
    raiseIfMissingKey: true,
  });
}

async function missingMessage(file: EncryptedFile): Promise<string> {
  if (!(await file.isKey())) {
    return `Missing '${file.keyPath}' to decrypt data. See \`trails encrypted --help\`.`;
  }
  return `File '${file.contentPath}' does not exist. Use \`trails encrypted edit ${file.contentPath} --key ${file.keyPath}\` to change that.`;
}

export function encryptedCommand(): Command {
  const cmd = new Command("encrypted");
  cmd.description("Edit and show encrypted files");

  cmd
    .command("edit <file>")
    .description("Open the decrypted file in `$VISUAL` or `$EDITOR` for editing")
    .option(
      "-k, --key <path>",
      "Path to the encryption key (Rails.root-relative)",
      "config/master.key",
    )
    .action(async (file: string, opts: EncryptedOptions) => {
      const encFile = buildFile(file, opts);
      await editEncryptedFile(encFile, { generateKeyIfMissing: true });
    });

  cmd
    .command("show <file>")
    .description("Show the decrypted contents of the file")
    .option(
      "-k, --key <path>",
      "Path to the encryption key (Rails.root-relative)",
      "config/master.key",
    )
    .action(async (file: string, opts: EncryptedOptions) => {
      const encFile = buildFile(file, opts);
      try {
        const contents = await encFile.read();
        stdout.write(`${contents.length > 0 ? contents : await missingMessage(encFile)}\n`);
      } catch (e) {
        if (e instanceof MissingKeyError || e instanceof MissingContentError) {
          stdout.write(`${await missingMessage(encFile)}\n`);
        } else {
          stdout.write(`Couldn't decrypt ${file}. Perhaps you passed the wrong key?\n`);
        }
        setExitCode(1);
      }
    });

  return cmd;
}
