const SW_PATH = "/dev-server-sw.js";

export interface DevServer {
  baseUrl: string;
  connected: boolean;
  /** Push a fresh DB snapshot to the service worker. */
  sync: (dbBytes: Uint8Array) => void;
  /** Unregister the service worker. */
  destroy: () => Promise<void>;
  /** Register a callback for when a SW update is available. */
  onUpdate: (fn: () => void) => void;
  /** Apply a pending SW update (triggers page reload). */
  applyUpdate: () => void;
  /** Whether a SW update is waiting. */
  updateAvailable: boolean;
}

export async function createDevServer(): Promise<DevServer> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers not supported");
  }

  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });

  // Wait for the SW to activate
  await new Promise<void>((resolve) => {
    const worker = reg.active ?? reg.installing ?? reg.waiting;
    if (!worker) throw new Error("No service worker found");
    if (worker.state === "activated") {
      resolve();
      return;
    }
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve();
    });
  });

  function getController(): ServiceWorker | null {
    return navigator.serviceWorker.controller ?? reg.active;
  }

  const updateCallbacks: Array<() => void> = [];

  // Listen for new SW versions
  reg.addEventListener("updatefound", () => {
    const newWorker = reg.installing;
    if (!newWorker) return;
    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        // New version waiting
        server.updateAvailable = true;
        for (const fn of updateCallbacks) fn();
      }
    });
  });

  // Also detect if a waiting worker already exists
  if (reg.waiting && navigator.serviceWorker.controller) {
    server.updateAvailable = true;
  }

  // When the controller changes (new SW took over), reload
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  const server: DevServer = {
    baseUrl: "/~dev/",
    connected: true,
    updateAvailable: false,

    sync(dbBytes: Uint8Array) {
      const sw = getController();
      if (!sw) return;
      sw.postMessage({ type: "dev-server:snapshot", data: dbBytes });
    },

    async destroy() {
      await reg.unregister();
      server.connected = false;
    },

    onUpdate(fn: () => void) {
      updateCallbacks.push(fn);
    },

    applyUpdate() {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "skip-waiting" });
      }
    },
  };

  return server;
}
