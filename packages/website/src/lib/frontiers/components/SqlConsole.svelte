<script lang="ts">
  import type { Runtime } from "$frontiers/runtime.js";

  let { runtime, onchange }: { runtime: Runtime; onchange: () => void } = $props();

  let sqlInput = $state("");
  let sqlResults: Array<{ columns: string[]; values: unknown[][] }> = $state([]);
  let sqlError = $state("");

  function runSQL() {
    sqlError = "";
    sqlResults = [];
    try {
      sqlResults = runtime.executeSQL(sqlInput);
    } catch (e: any) {
      sqlError = e.message;
    }
    onchange();
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSQL(); }
  }
</script>

<div class="flex h-full flex-col gap-3">
  <div class="flex gap-2">
    <textarea
      bind:value={sqlInput}
      onkeydown={handleKeydown}
      class="flex-1 resize-none rounded border border-border bg-surface-overlay p-2 font-mono text-xs text-text outline-none focus:border-border-focus"
      rows="4"
      placeholder="SELECT * FROM ..."
      spellcheck="false"
    ></textarea>
    <button class="self-end rounded bg-accent px-3 py-1 text-xs font-medium text-surface hover:bg-accent-hover" onclick={runSQL}>
      Run <kbd class="ml-1 text-[10px] opacity-60">Ctrl+Enter</kbd>
    </button>
  </div>
  {#if sqlError}
    <div class="rounded border border-error/30 bg-error/10 p-2"><pre class="text-xs text-error">{sqlError}</pre></div>
  {/if}
  {#each sqlResults as result, i}
    <div class="overflow-auto">
      {#if sqlResults.length > 1}<div class="mb-1 text-[10px] text-text-muted">Result set {i + 1} ({result.values.length} rows)</div>{/if}
      <table class="w-full text-xs">
        <thead><tr class="border-b border-border text-left text-text-muted">{#each result.columns as col}<th class="whitespace-nowrap px-2 py-1">{col}</th>{/each}</tr></thead>
        <tbody>{#each result.values as row}<tr class="border-b border-border/50 hover:bg-surface-overlay/50">{#each row as cell}<td class="whitespace-nowrap px-2 py-1 {cell === null ? 'italic text-text-muted' : ''}">{cell ?? "NULL"}</td>{/each}</tr>{/each}</tbody>
      </table>
    </div>
  {/each}
</div>
