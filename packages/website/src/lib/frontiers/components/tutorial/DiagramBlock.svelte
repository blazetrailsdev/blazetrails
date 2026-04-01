<script lang="ts">
  import { onMount } from "svelte";
  import { renderDiagram } from "../../tutorials/diagram-renderer.js";

  interface Props {
    source: string;
    label?: string;
  }

  let { source, label }: Props = $props();

  let svg = $state<string | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  onMount(async () => {
    const result = await renderDiagram(source);
    if (result.success) {
      svg = result.svg!;
    } else {
      error = result.error ?? "Failed to render diagram";
    }
    loading = false;
  });
</script>

<div
  class="rounded border border-border bg-surface-overlay p-3"
  data-testid="diagram-block"
  aria-label={label}
>
  {#if loading}
    <div class="flex items-center justify-center py-4" data-testid="diagram-loading">
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
      <span class="ml-2 text-xs text-text-muted">Loading diagram…</span>
    </div>
  {:else if error}
    <div class="rounded bg-surface p-2" data-testid="diagram-error">
      <p class="text-xs text-error">Diagram error: {error}</p>
      <pre class="mt-1 text-[10px] text-text-muted">{source.slice(0, 200)}</pre>
    </div>
  {:else if svg}
    <div class="overflow-auto" data-testid="diagram-svg">
      {@html svg}
    </div>
  {/if}
</div>
