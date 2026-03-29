<script lang="ts">
  let {
    openFiles = $bindable([]),
    activeFilePath = $bindable(""),
  }: {
    openFiles: string[];
    activeFilePath: string;
  } = $props();

  function fileName(path: string) {
    return path.split("/").pop() ?? path;
  }

  function closeTab(path: string, e: MouseEvent) {
    e.stopPropagation();
    const idx = openFiles.indexOf(path);
    openFiles = openFiles.filter((p) => p !== path);
    if (activeFilePath === path) {
      activeFilePath = openFiles[Math.min(idx, openFiles.length - 1)] ?? "";
    }
  }
</script>

{#if openFiles.length > 0}
  <div class="flex overflow-x-auto border-b border-border bg-surface">
    {#each openFiles as path}
      <button
        class="group flex shrink-0 items-center gap-1.5 border-r border-border px-3 py-1 text-[11px] {activeFilePath === path
          ? 'bg-surface-raised text-text border-b-2 border-b-accent -mb-px'
          : 'text-text-muted hover:text-text hover:bg-surface-raised'}"
        onclick={() => (activeFilePath = path)}
      >
        <span class="max-w-28 truncate">{fileName(path)}</span>
        <span
          role="button"
          tabindex="-1"
          class="ml-0.5 hidden rounded px-0.5 text-[10px] text-text-muted hover:bg-surface-overlay hover:text-text group-hover:inline"
          onclick={(e) => closeTab(path, e)}
          onkeydown={(e) => { if (e.key === "Enter") closeTab(path, e as any); }}
        >x</span>
      </button>
    {/each}
  </div>
{/if}
