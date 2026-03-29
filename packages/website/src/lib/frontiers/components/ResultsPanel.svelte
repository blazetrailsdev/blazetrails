<script lang="ts">
  let {
    output,
    error,
    executing,
  }: {
    output: string;
    error: string;
    executing: boolean;
  } = $props();

  // Try to parse output as an array of objects for table rendering
  const parsed = $derived(() => {
    if (!output) return null;
    try {
      const val = JSON.parse(output);
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
        const keys = Object.keys(val[0]);
        return { keys, rows: val };
      }
    } catch {
      // not JSON
    }
    return null;
  });

  const tableData = $derived(parsed());
</script>

{#if executing}
  <div class="flex items-center gap-2 text-sm text-text-muted">
    <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
    Running...
  </div>
{:else if error}
  <div class="rounded border border-error/30 bg-error/10 p-3">
    <pre class="whitespace-pre-wrap text-sm text-error">{error}</pre>
  </div>
{:else if tableData}
  <div class="overflow-auto">
    <div class="mb-2 text-[10px] text-text-muted">{tableData.rows.length} row{tableData.rows.length !== 1 ? "s" : ""}</div>
    <table class="w-full text-xs">
      <thead>
        <tr class="border-b border-border text-left text-text-muted">
          {#each tableData.keys as key}
            <th class="whitespace-nowrap px-2 py-1">{key}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each tableData.rows as row}
          <tr class="border-b border-border/50 hover:bg-surface-overlay/50">
            {#each tableData.keys as key}
              {@const val = row[key]}
              <td class="max-w-48 truncate whitespace-nowrap px-2 py-1 {val === null || val === undefined ? 'italic text-text-muted' : ''}">{val ?? "NULL"}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if output}
  <pre class="overflow-auto rounded bg-surface-overlay p-3 text-sm text-text">{output}</pre>
{:else}
  <p class="text-sm text-text-muted">Run a file to see results here.</p>
{/if}
