<script lang="ts">
  import type { VfsFile } from "$frontiers/virtual-fs.js";

  let {
    files,
    onselect,
    onclose,
  }: {
    files: VfsFile[];
    onselect: (path: string) => void;
    onclose: () => void;
  } = $props();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const filtered = $derived(
    query.trim()
      ? files.filter((f) => {
          const q = query.toLowerCase();
          const name = f.path.toLowerCase();
          // Fuzzy: every char in query appears in order
          let qi = 0;
          for (let i = 0; i < name.length && qi < q.length; i++) {
            if (name[i] === q[qi]) qi++;
          }
          return qi === q.length;
        })
      : files,
  );

  $effect(() => {
    if (selectedIndex >= filtered.length) selectedIndex = Math.max(0, filtered.length - 1);
  });

  $effect(() => {
    inputEl?.focus();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") { onclose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); selectedIndex = Math.max(selectedIndex - 1, 0); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onselect(filtered[selectedIndex].path);
        onclose();
      }
      return;
    }
  }

  function fileName(path: string) {
    return path.split("/").pop() ?? path;
  }

  function fileDir(path: string) {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[90] flex justify-center pt-16" onclick={onclose} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="w-96 rounded-lg border border-border bg-surface-raised shadow-xl" onclick={(e) => e.stopPropagation()}>
    <div class="border-b border-border px-3 py-2">
      <input
        bind:this={inputEl}
        bind:value={query}
        class="w-full bg-transparent text-sm text-text outline-none"
        placeholder="Go to file..."
        spellcheck="false"
      />
    </div>
    <div class="max-h-64 overflow-auto py-1">
      {#if filtered.length === 0}
        <div class="px-3 py-2 text-xs text-text-muted">No matching files</div>
      {:else}
        {#each filtered as file, i}
          <button
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs {i === selectedIndex ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-overlay'}"
            onclick={() => { onselect(file.path); onclose(); }}
            onmouseenter={() => (selectedIndex = i)}
          >
            <span class="font-medium">{fileName(file.path)}</span>
            <span class="text-text-muted">{fileDir(file.path)}</span>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
