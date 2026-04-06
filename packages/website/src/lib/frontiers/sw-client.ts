/**
 * Main-thread client for communicating with the sandbox service worker.
 * Uses MessageChannel for request/response pairs and listens for broadcasts.
 */

import type { SwRequest, SwResponse, SwBroadcast } from "./sw-protocol.js";

export interface SwClient {
  /** Send a request and wait for the response. */
  send<T extends SwResponse>(request: SwRequest): Promise<T>;
  /** Register a listener for broadcast messages from the SW. */
  onBroadcast(fn: (msg: SwBroadcast) => void): () => void;
  /** Unregister the service worker. */
  destroy(): Promise<void>;
  /** Whether the SW is connected and ready. */
  readonly ready: boolean;
}

const SW_PATH = "/sandbox-sw.js";
const INIT_TIMEOUT = 10_000;
const REQUEST_TIMEOUT = 30_000;

export async function createSwClient(): Promise<SwClient> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported");
  }

  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });

  // Wait for activation
  await new Promise<void>((resolve, reject) => {
    const worker = reg.active ?? reg.installing ?? reg.waiting;
    if (!worker) {
      reject(new Error("No service worker found after registration"));
      return;
    }
    if (worker.state === "activated") {
      resolve();
      return;
    }
    const onStateChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", onStateChange);
        resolve();
      }
    };
    worker.addEventListener("statechange", onStateChange);
  });

  const broadcastListeners: Array<(msg: SwBroadcast) => void> = [];

  // Listen for broadcasts from SW
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as SwBroadcast;
    if (data?.type === "vfs:changed" || data?.type === "db:changed") {
      for (const fn of broadcastListeners) fn(data);
    }
  });

  function getController(): ServiceWorker {
    const sw = navigator.serviceWorker.controller ?? reg.active;
    if (!sw) throw new Error("Service worker not available");
    return sw;
  }

  let isReady = false;

  const client: SwClient = {
    get ready() {
      return isReady;
    },

    async send<T extends SwResponse>(request: SwRequest): Promise<T> {
      const sw = getController();
      return new Promise<T>((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => {
          reject(new Error(`SW request timed out: ${request.type}`));
        }, REQUEST_TIMEOUT);

        channel.port1.onmessage = (event) => {
          clearTimeout(timer);
          const response = event.data as SwResponse;
          if (response.type === "error") {
            reject(new Error((response as { type: "error"; message: string }).message));
          } else {
            resolve(response as T);
          }
        };

        sw.postMessage(request, [channel.port2]);
      });
    },

    onBroadcast(fn: (msg: SwBroadcast) => void): () => void {
      broadcastListeners.push(fn);
      return () => {
        const idx = broadcastListeners.indexOf(fn);
        if (idx >= 0) broadcastListeners.splice(idx, 1);
      };
    },

    async destroy() {
      isReady = false;
      await reg.unregister();
    },
  };

  // Send init and wait for ready
  const initResponse = await Promise.race([
    client.send<SwResponse & { type: "init" }>({ type: "init" }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SW init timed out")), INIT_TIMEOUT),
    ),
  ]);

  if (initResponse.type === "init") {
    isReady = true;
  }

  return client;
}
