import { Message } from "./message.js";
import { MessageSerializer } from "./message-serializer.js";

/**
 * A message serializer using a compact binary-like format. In Rails,
 * this uses MessagePack for smaller payloads. Our implementation
 * currently delegates to JSON-based MessageSerializer, producing
 * functionally equivalent output at larger size.
 *
 * TODO: Integrate a real MessagePack library (e.g. @msgpack/msgpack)
 * for compact binary serialization.
 *
 * Mirrors: ActiveRecord::Encryption::MessagePackMessageSerializer
 */
export class MessagePackMessageSerializer {
  private _fallback: MessageSerializer;

  constructor() {
    this._fallback = new MessageSerializer();
  }

  dump(message: Message): string {
    return this._fallback.dump(message);
  }

  load(serialized: string): Message {
    return this._fallback.load(serialized);
  }
}
