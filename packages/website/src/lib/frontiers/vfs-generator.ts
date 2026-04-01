import { AppGenerator, ModelGenerator, MigrationGenerator } from "@blazetrails/railties/generators";
import type { AppOptions } from "@blazetrails/railties/generators";
import type { VirtualFS } from "./virtual-fs.js";

export interface VfsGeneratorOptions {
  vfs: VirtualFS;
  output: (msg: string) => void;
}

export class VfsMigrationGenerator extends MigrationGenerator {
  private _vfs: VirtualFS;

  constructor(options: VfsGeneratorOptions) {
    super({ cwd: "/", output: options.output });
    this._vfs = options.vfs;
  }

  protected override isTypeScript(): boolean {
    return true;
  }

  protected override createFile(relativePath: string, content: string): void {
    this._vfs.write(relativePath, content);
    this.createdFiles.push(relativePath);
    this.output(`      create  ${relativePath}`);
  }

  protected override fileExists(relativePath: string): boolean {
    return this._vfs.exists(relativePath);
  }
}

export class VfsModelGenerator extends ModelGenerator {
  private _vfs: VirtualFS;
  private _vfsOutput: (msg: string) => void;

  constructor(options: VfsGeneratorOptions) {
    super({ cwd: "/", output: options.output });
    this._vfs = options.vfs;
    this._vfsOutput = options.output;
  }

  protected override isTypeScript(): boolean {
    return true;
  }

  protected override createFile(relativePath: string, content: string): void {
    this._vfs.write(relativePath, content);
    this.createdFiles.push(relativePath);
    this.output(`      create  ${relativePath}`);
  }

  protected override fileExists(relativePath: string): boolean {
    return this._vfs.exists(relativePath);
  }

  protected override createMigrationGenerator(): MigrationGenerator {
    return new VfsMigrationGenerator({ vfs: this._vfs, output: this._vfsOutput });
  }
}

export class VfsAppGenerator extends AppGenerator {
  private _vfs: VirtualFS;

  constructor(options: VfsGeneratorOptions) {
    super({ cwd: "/", output: options.output });
    this._vfs = options.vfs;
  }

  protected override isTypeScript(): boolean {
    return true;
  }

  protected override createFile(relativePath: string, content: string): void {
    this._vfs.write(relativePath, content);
    this.createdFiles.push(relativePath);
    this.output(`      create  ${relativePath}`);
  }

  protected override fileExists(relativePath: string): boolean {
    return this._vfs.exists(relativePath);
  }

  override async run(name: string, options: AppOptions): Promise<string[]> {
    // AppGenerator.run() sets this.cwd to a subdirectory — we don't want that
    // in VFS since all paths are relative. Override to skip git/install and
    // keep paths at root level.
    return super.run(name, { ...options, skipGit: true, skipInstall: true, skipDocker: true });
  }
}
