<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { DevServer } from "$frontiers/dev-server.js";
  import type { PreviewServer } from "$frontiers/preview-server.js";

  let {
    devServer,
    previewServer,
    onerror,
  }: {
    devServer: DevServer | null;
    previewServer: PreviewServer | null;
    onerror?: (message: string) => void;
  } = $props();

  let previewUrl = $state("/~dev/");
  let previewKey = $state(0);
  let blobUrl = $state("");
  let errors: string[] = $state([]);

  const useSW = $derived(devServer?.connected ?? false);

  export function refresh() {
    errors = [];
    if (useSW) {
      previewKey++;
    } else if (previewServer) {
      if (blobUrl) previewServer.revoke(blobUrl);
      blobUrl = previewServer.getUrl("index.html");
      previewKey++;
    }
  }

  function handleMessage(event: MessageEvent) {
    if (event.data?.type === "frontiers:error") {
      const msg = event.data.message ?? "Unknown error";
      errors = [...errors, msg];
      onerror?.(msg);
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
    // Generate initial blob URL if no SW
    if (!useSW && previewServer) {
      blobUrl = previewServer.getUrl("index.html");
    }
    return () => {
      window.removeEventListener("message", handleMessage);
      if (blobUrl && previewServer) previewServer.revoke(blobUrl);
    };
  });

  const iframeSrc = $derived(useSW ? previewUrl : blobUrl);
</script>

<div class="flex h-full flex-col gap-2 -m-3">
  <div class="flex items-center gap-2 border-b border-border bg-surface-raised px-3 py-1">
    {#if useSW}
      <span class="text-[10px] text-text-muted">/~dev/</span>
      <input
        bind:value={previewUrl}
        onkeydown={(e) => { if (e.key === "Enter") refresh(); }}
        class="flex-1 rounded border border-border bg-surface-overlay px-2 py-0.5 text-xs text-text outline-none focus:border-border-focus"
        spellcheck="false"
      />
    {:else}
      <span class="flex-1 text-[10px] text-text-muted">Preview (blob mode — no HTTPS for service worker)</span>
    {/if}
    <button class="rounded border border-border px-2 py-0.5 text-xs text-text-muted hover:text-accent" onclick={refresh}>Refresh</button>
  </div>
  {#if iframeSrc}
    {#key previewKey}
      <iframe
        src={iframeSrc}
        class="flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms"
        title="Preview"
      ></iframe>
    {/key}
  {:else}
    <div class="flex flex-1 items-center justify-center">
      <p class="text-sm text-text-muted">No index.html in the VFS. Create one to preview.</p>
    </div>
  {/if}
  {#if errors.length > 0}
    <div class="border-t border-error/30 bg-error/5 px-3 py-1.5">
      <div class="mb-1 flex items-center justify-between">
        <span class="text-[10px] font-medium text-error">Preview Errors ({errors.length})</span>
        <button class="text-[10px] text-text-muted hover:text-text" onclick={() => (errors = [])}>Clear</button>
      </div>
      {#each errors.slice(-5) as err}
        <pre class="text-[10px] text-error">{err}</pre>
      {/each}
    </div>
  {/if}
</div>
