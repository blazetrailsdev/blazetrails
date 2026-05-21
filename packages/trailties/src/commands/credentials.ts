import { Command } from "commander";
import { EncryptedFile, MissingKeyError } from "@blazetrails/activesupport/encrypted-file";
import { env, stdout, setExitCode } from "@blazetrails/activesupport/process-adapter";
import { editEncryptedFile, type EditOptions } from "../encrypted-file-editor.js";

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

export function credentialsCommand(): Command {
  const cmd = new Command("credentials");
  cmd.description("Edit and show encrypted credentials");

  cmd
    .command("edit")
    .description("Open the decrypted credentials in `$VISUAL` or `$EDITOR` for editing")
    .option("-e, --environment <env>", "Use config/credentials/<env>.yml.enc and .key")
    .action(async (opts: CredentialsOptions) => {
      const file = buildFile(opts);
      const editOpts: EditOptions = { generateKeyIfMissing: true };
      await editEncryptedFile(file, editOpts);
    });

  cmd
    .command("show")
    .description("Show the decrypted credentials")
    .option("-e, --environment <env>", "Use config/credentials/<env>.yml.enc and .key")
    .action(async (opts: CredentialsOptions) => {
      const file = buildFile(opts);
      try {
        const contents = await file.read();
        stdout.write(contents.length > 0 ? contents : missingMessage(opts));
        stdout.write("\n");
      } catch (e) {
        if (e instanceof MissingKeyError) {
          stdout.write(`${e.message}\n`);
          setExitCode(1);
          return;
        }
        stdout.write(`${missingMessage(opts)}\n`);
        setExitCode(1);
      }
    });

  return cmd;
}

function missingMessage(opts: CredentialsOptions): string {
  const { contentPath, keyPath } = pathsFor(opts);
  const keyVal = env.RAILS_MASTER_KEY;
  if (!keyVal || keyVal.length === 0) {
    return `Missing '${keyPath}' to decrypt credentials. See \`trails credentials --help\`.`;
  }
  return `File '${contentPath}' does not exist. Use \`trails credentials edit\` to change that.`;
}
