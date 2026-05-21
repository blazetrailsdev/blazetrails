import { Command } from "commander";
import {
  EncryptedFile,
  MissingContentError,
  MissingKeyError,
} from "@blazetrails/activesupport/encrypted-file";
import { stdout, setExitCode } from "@blazetrails/activesupport/process-adapter";
import { editEncryptedFile } from "../encrypted-file-editor.js";

interface CredentialsOptions {
  environment?: string;
}

function pathsFor(opts: CredentialsOptions): { contentPath: string; keyPath: string } {
  if (opts.environment && opts.environment.length > 0) {
    return {
      contentPath: `config/credentials/${opts.environment}.yml.enc`,
      keyPath: `config/credentials/${opts.environment}.key`,
    };
  }
  return { contentPath: "config/credentials.yml.enc", keyPath: "config/master.key" };
}

function buildFile(opts: CredentialsOptions): EncryptedFile {
  const { contentPath, keyPath } = pathsFor(opts);
  return new EncryptedFile({
    contentPath,
    keyPath,
    envKey: "RAILS_MASTER_KEY",
    raiseIfMissingKey: true,
  });
}

async function missingMessage(file: EncryptedFile): Promise<string> {
  if (!(await file.isKey())) {
    return `Missing '${file.keyPath}' to decrypt credentials. See \`trails credentials --help\`.`;
  }
  return `File '${file.contentPath}' does not exist. Use \`trails credentials edit\` to change that.`;
}

export function credentialsCommand(): Command {
  const cmd = new Command("credentials");
  cmd.description("Edit and show encrypted credentials");

  cmd
    .command("edit")
    .description("Open the decrypted credentials in `$VISUAL` or `$EDITOR` for editing")
    .option("-e, --environment <env>", "Use config/credentials/<env>.yml.enc and .key")
    .action(async (opts: CredentialsOptions) => {
      const file = buildFile(opts);
      await editEncryptedFile(file, { generateKeyIfMissing: true });
    });

  cmd
    .command("show")
    .description("Show the decrypted credentials")
    .option("-e, --environment <env>", "Use config/credentials/<env>.yml.enc and .key")
    .action(async (opts: CredentialsOptions) => {
      const file = buildFile(opts);
      try {
        const contents = await file.read();
        stdout.write(`${contents.length > 0 ? contents : await missingMessage(file)}\n`);
      } catch (e) {
        if (e instanceof MissingKeyError || e instanceof MissingContentError) {
          stdout.write(`${await missingMessage(file)}\n`);
        } else {
          stdout.write(`Couldn't decrypt ${file.contentPath}. Perhaps you passed the wrong key?\n`);
        }
        setExitCode(1);
      }
    });

  return cmd;
}
