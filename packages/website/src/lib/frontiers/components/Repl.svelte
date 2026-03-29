<script lang="ts">
  import type { Runtime } from "$frontiers/runtime.js";

  let { runtime, onchange }: { runtime: Runtime; onchange: () => void } = $props();

  let replInput = $state("");
  let history: Array<{ input: string; output: string; isError: boolean }> = $state([]);
  let el: HTMLDivElement | undefined = $state();

  function formatValue(v: unknown): string {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return v;
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }

  async function run() {
    if (!replInput.trim()) return;
    const input = replInput;
    replInput = "";
    try {
      const result = await runtime.executeCode(`return (${input})`);
      history = [...history, { input, output: formatValue(await result), isError: false }];
    } catch {
      try {
        const result = await runtime.executeCode(input);
        history = [...history, { input, output: formatValue(await result), isError: false }];
      } catch (e: any) {
        history = [...history, { input, output: e.message, isError: true }];
      }
    }
    onchange();
    requestAnimationFrame(() => el?.scrollTo(0, el.scrollHeight));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); }
  }
</script>

<div class="flex h-full flex-col">
  <div bind:this={el} class="flex-1 space-y-2 overflow-auto pb-2">
    {#if history.length === 0}
      <p class="text-xs text-text-muted">Type expressions and press Enter to evaluate.</p>
    {/if}
    {#each history as entry}
      <div class="space-y-0.5">
        <div class="flex items-start gap-1.5"><span class="text-xs text-accent">&gt;</span><pre class="text-xs text-text">{entry.input}</pre></div>
        <div class="flex items-start gap-1.5 pl-3"><pre class="text-xs {entry.isError ? 'text-error' : 'text-text-muted'}">{entry.output}</pre></div>
      </div>
    {/each}
  </div>
  <div class="flex items-center gap-1.5 border-t border-border pt-2">
    <span class="text-xs text-accent">&gt;</span>
    <input bind:value={replInput} onkeydown={handleKeydown} class="flex-1 bg-transparent font-mono text-xs text-text outline-none" placeholder="Expression..." spellcheck="false" />
  </div>
</div>
