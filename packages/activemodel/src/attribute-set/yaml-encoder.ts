export class YAMLEncoder {
  encode(set: unknown): string {
    return JSON.stringify(set);
  }

  decode(yaml: string): unknown {
    return JSON.parse(yaml);
  }
}
