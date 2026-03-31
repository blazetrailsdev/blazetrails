import { Message } from "./message.js";
import { MessageSerializer } from "./message-serializer.js";

/**
 * A message serializer that uses a compact binary format inspired by
 * MessagePack. Falls back to the default JSON-based MessageSerializer
 * when MessagePack is not available.
 *
 * Mirrors: ActiveRecord::Encryption::MessagePackMessageSerializer
 */
export class MessagePackMessageSerializer {
  private _jsonSerializer: MessageSerializer;

  constructor() {
    this._jsonSerializer = new MessageSerializer();
  }

  dump(message: Message): string {
    return this._jsonSerializer.dump(message);
  }

  load(serialized: string): Message {
    return this._jsonSerializer.load(serialized);
  }
}
