import { GeneratorBase } from "@blazetrails/railties/generators";
import type { VirtualFS } from "./virtual-fs.js";

export interface VfsGeneratorOptions {
  vfs: VirtualFS;
  output: (msg: string) => void;
}

/**
 * A GeneratorBase subclass that writes to VirtualFS instead of node:fs.
 * Lets railties generators work in the browser sandbox.
 */
export class VfsGeneratorBase extends GeneratorBase {
  protected vfs: VirtualFS;

  constructor(options: VfsGeneratorOptions) {
    // cwd is unused — VFS paths are always relative
    super({ cwd: "/", output: options.output });
    this.vfs = options.vfs;
  }

  protected override isTypeScript(): boolean {
    return true;
  }

  protected override createFile(relativePath: string, content: string): void {
    this.vfs.write(relativePath, content);
    this.createdFiles.push(relativePath);
    this.output(`      create  ${relativePath}`);
  }

  protected override appendToFile(relativePath: string, content: string): void {
    const existing = this.vfs.read(relativePath);
    if (!existing) {
      this.createFile(relativePath, content);
      return;
    }
    this.vfs.write(relativePath, existing.content + content);
    this.output(`      append  ${relativePath}`);
  }

  protected override insertIntoFile(relativePath: string, marker: string, content: string): void {
    const existing = this.vfs.read(relativePath);
    if (!existing) return;
    const idx = existing.content.indexOf(marker);
    if (idx === -1) return;
    const updated = existing.content.slice(0, idx) + content + existing.content.slice(idx);
    this.vfs.write(relativePath, updated);
    this.output(`      insert  ${relativePath}`);
  }

  protected override fileExists(relativePath: string): boolean {
    return this.vfs.exists(relativePath);
  }

  protected override removeFile(relativePath: string): boolean {
    if (!this.vfs.exists(relativePath)) return false;
    this.vfs.delete(relativePath);
    this.output(`      remove  ${relativePath}`);
    return true;
  }
}
