<script lang="ts">
  export interface Command {
    id: string;
    label: string;
    shortcut?: string;
    action: () => void;
  }

  let {
    commands,
    onclose,
  }: {
    commands: Command[];
    onclose: () => void;
  } = $props();

  let query = $state("");
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const filtered = $derived(
    query.trim()
      ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
      : commands,
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
        filtered[selectedIndex].action();
        onclose();
      }
      return;
    }
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
        placeholder="Type a command..."
        spellcheck="false"
      />
    </div>
    <div class="max-h-64 overflow-auto py-1">
      {#if filtered.length === 0}
        <div class="px-3 py-2 text-xs text-text-muted">No matching commands</div>
      {:else}
        {#each filtered as cmd, i}
          <button
            class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs {i === selectedIndex ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-overlay'}"
            onclick={() => { cmd.action(); onclose(); }}
            onmouseenter={() => (selectedIndex = i)}
          >
            <span>{cmd.label}</span>
            {#if cmd.shortcut}
              <kbd class="text-[10px] text-text-muted">{cmd.shortcut}</kbd>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
