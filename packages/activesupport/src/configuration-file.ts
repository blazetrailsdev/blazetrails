import { readFileSync } from "fs";
import { parse as yamlParse } from "yaml";

export class ConfigurationFile {
  private content: string;
  private contentPath: string;

  constructor(contentPath: string) {
    this.contentPath = contentPath;
    this.content = readFileSync(contentPath, "utf-8");
  }

  static parse(contentPath: string): Record<string, unknown> {
    return new ConfigurationFile(contentPath).parse();
  }

  parse(): Record<string, unknown> {
    if (this.content.includes("\u00A0")) {
      console.warn(
        `${this.contentPath} contains invisible non-breaking spaces, you may want to remove those`,
      );
    }

    try {
      return (yamlParse(this.content) as Record<string, unknown>) || {};
    } catch (error: any) {
      throw new ConfigurationFile.FormatError(
        `YAML syntax error occurred while parsing ${this.contentPath}. ` +
          `Please note that YAML must be consistently indented using spaces. Tabs are not allowed. ` +
          `Error: ${error.message}`,
      );
    }
  }

  static FormatError = class FormatError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "FormatError";
    }
  };
}
