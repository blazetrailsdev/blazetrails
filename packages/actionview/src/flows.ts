import { SafeBuffer, htmlSafe } from "@blazetrails/activesupport";

/**
 * OutputFlow — buffered storage for `content_for` / `provide`.
 * Mirrors `ActionView::OutputFlow`. Missing keys lazily create an empty
 * `SafeBuffer` so `<<` appends are well-defined.
 */
export class OutputFlow {
  readonly content: Map<string, SafeBuffer> = new Map();

  get(key: string): SafeBuffer {
    let buf = this.content.get(key);
    if (!buf) {
      buf = htmlSafe("");
      this.content.set(key, buf);
    }
    return buf;
  }

  set(key: string, value: unknown): void {
    this.content.set(key, htmlSafe(value == null ? "" : String(value)));
  }

  append(key: string, value: unknown): void {
    if (value == null) return;
    const current = this.get(key);
    const piece: string | SafeBuffer = value instanceof SafeBuffer ? value : String(value);
    this.content.set(key, current.concat(piece));
  }

  appendBang(key: string, value: unknown): void {
    this.append(key, value);
  }
}
