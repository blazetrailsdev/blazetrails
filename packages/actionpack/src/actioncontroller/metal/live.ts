/**
 * ActionController::Live
 *
 * Mix this module into your controller to stream data to the client.
 * @see https://api.rubyonrails.org/classes/ActionController/Live.html
 */

export class ClientDisconnected extends Error {
  constructor(message?: string) {
    super(message ?? "Client disconnected");
    this.name = "ClientDisconnected";
  }
}

export class Buffer {
  private _data: string[] = [];
  private _closed = false;

  write(chunk: string): void {
    if (this._closed) throw new ClientDisconnected();
    this._data.push(chunk);
  }

  close(): void {
    this._closed = true;
  }

  get closed(): boolean {
    return this._closed;
  }
}

export class SSE {
  private _stream: Buffer;

  constructor(stream: Buffer, _options: { retry?: number; event?: string } = {}) {
    this._stream = stream;
  }

  write(_object: unknown, _options: { event?: string; id?: string; retry?: number } = {}): void {
    // SSE write implementation
  }

  close(): void {
    this._stream.close();
  }
}

export class Response {
  headers: Record<string, string> = {};
  stream: Buffer = new Buffer();
  status: number = 200;
}

export interface Live {
  response: Response;
}
