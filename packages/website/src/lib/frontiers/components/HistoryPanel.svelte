<script lang="ts">
  import type { Runtime } from "$frontiers/runtime.js";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let { runtime, onrestore }: { runtime: Runtime; onrestore: () => void } = $props();

  let snapshots: Array<{ id: number; label: string; size: number; createdAt: string }> = $state([]);
  let confirmRestore = $state<number | null>(null);

  export function refresh() {
    snapshots = runtime.history.list();
  }

  function saveSnapshot() {
    const label = new Date().toLocaleString();
    runtime.history.save(runtime.exportDB(), label);
    refresh();
  }

  function restoreSnapshot(id: number) {
    const data = runtime.history.load(id);
    if (!data) return;
    runtime.loadDB(data);
    confirmRestore = null;
    onrestore();
    refresh();
  }

  function deleteSnapshot(id: number) {
    runtime.history.delete(id);
    refresh();
  }

  function formatSize(bytes: number) {
    return bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
  }
</script>

<div class="space-y-3">
  <div class="flex items-center gap-2">
    <span class="text-xs font-medium text-text-muted">Version History</span>
    <button
      class="rounded border border-border px-2 py-0.5 text-[10px] text-text-muted hover:border-accent hover:text-accent"
      onclick={saveSnapshot}
    >Save snapshot</button>
  </div>

  {#if snapshots.length === 0}
    <p class="text-xs text-text-muted">No snapshots yet. Click "Save snapshot" to create one.</p>
  {:else}
    <div class="space-y-1.5">
      {#each snapshots as snap}
        <div class="group flex items-center gap-2 rounded border border-border/50 bg-surface-overlay px-2 py-1.5">
          <div class="flex-1">
            <div class="text-xs text-text">{snap.label || `Snapshot #${snap.id}`}</div>
            <div class="text-[10px] text-text-muted">{snap.createdAt} -- {formatSize(snap.size)}</div>
          </div>
          <button
            class="hidden rounded px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/10 group-hover:block"
            onclick={() => (confirmRestore = snap.id)}
          >Restore</button>
          <button
            class="hidden px-1 text-[10px] text-text-muted hover:text-error group-hover:block"
            onclick={() => deleteSnapshot(snap.id)}
          >x</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if confirmRestore !== null}
  <ConfirmDialog
    message="Restore this snapshot? Current state will be lost unless you save a snapshot first."
    confirmLabel="Restore"
    destructive={true}
    onconfirm={() => restoreSnapshot(confirmRestore!)}
    oncancel={() => (confirmRestore = null)}
  />
{/if}
