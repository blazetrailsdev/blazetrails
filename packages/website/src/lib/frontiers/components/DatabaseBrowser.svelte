<script lang="ts">
  import { onMount } from "svelte";
  import type { Runtime } from "$frontiers/runtime.js";

  let { runtime }: { runtime: Runtime } = $props();

  let tables: string[] = $state([]);
  let selectedTable = $state("");
  let columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }> = $state([]);
  let tableData: { columns: string[]; rows: unknown[][] } = $state({ columns: [], rows: [] });
  let rowCount = $state(0);
  type View = "columns" | "data";
  let view: View = $state("columns");

  onMount(() => refresh());

  export function refresh() {
    tables = runtime.getTables();
    if (selectedTable && !tables.includes(selectedTable)) {
      selectedTable = "";
      columns = [];
      tableData = { columns: [], rows: [] };
    }
    if (selectedTable) selectTable(selectedTable);
  }

  function selectTable(table: string) {
    selectedTable = table;
    columns = runtime.getColumns(table);
    tableData = runtime.getTableData(table);
    rowCount = runtime.getRowCount(table);
  }
</script>

{#if tables.length === 0}
  <div class="space-y-2">
    <p class="text-sm text-text-muted">No tables yet. Run a migration or create a table.</p>
    <button class="text-[10px] text-text-muted hover:text-accent" onclick={refresh}>Refresh</button>
  </div>
{:else}
  <div class="flex h-full gap-4">
    <div class="w-40 shrink-0 space-y-1 overflow-auto">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-xs font-medium text-text-muted">Tables ({tables.length})</span>
        <button class="text-[10px] text-text-muted hover:text-accent" onclick={refresh}>Refresh</button>
      </div>
      {#each tables as table}
        <button
          class="block w-full rounded px-2 py-1 text-left text-xs {selectedTable === table ? 'bg-accent/20 text-accent' : 'text-text hover:bg-surface-overlay'}"
          onclick={() => selectTable(table)}
        >{table}</button>
      {/each}
    </div>
    {#if selectedTable}
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="mb-2 flex items-center gap-3">
          <span class="text-xs font-medium text-accent">{selectedTable}</span>
          <span class="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-text-muted">{rowCount} row{rowCount !== 1 ? "s" : ""}</span>
          <span class="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-text-muted">{columns.length} col{columns.length !== 1 ? "s" : ""}</span>
          <div class="ml-auto flex gap-1">
            <button class="rounded px-2 py-0.5 text-[10px] {view === 'columns' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}" onclick={() => (view = "columns")}>Schema</button>
            <button class="rounded px-2 py-0.5 text-[10px] {view === 'data' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'}" onclick={() => (view = "data")}>Data</button>
          </div>
        </div>
        {#if view === "columns"}
          <table class="w-full text-xs">
            <thead><tr class="border-b border-border text-left text-text-muted"><th class="px-2 py-1">#</th><th class="px-2 py-1">Column</th><th class="px-2 py-1">Type</th><th class="px-2 py-1">Not Null</th><th class="px-2 py-1">PK</th></tr></thead>
            <tbody>
              {#each columns as col, i}
                <tr class="border-b border-border/50 hover:bg-surface-overlay/50">
                  <td class="px-2 py-1 text-text-muted">{i + 1}</td>
                  <td class="px-2 py-1 font-medium text-accent">{col.name}</td>
                  <td class="px-2 py-1">{col.type || "—"}</td>
                  <td class="px-2 py-1">{col.notnull ? "NOT NULL" : ""}</td>
                  <td class="px-2 py-1">{col.pk ? "PK" : ""}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="overflow-auto">
            {#if tableData.rows.length === 0}
              <p class="text-xs text-text-muted">No rows</p>
            {:else}
              <table class="w-full text-xs">
                <thead><tr class="border-b border-border text-left text-text-muted">{#each tableData.columns as col}<th class="whitespace-nowrap px-2 py-1">{col}</th>{/each}</tr></thead>
                <tbody>
                  {#each tableData.rows as row}
                    <tr class="border-b border-border/50 hover:bg-surface-overlay/50">{#each row as cell}<td class="max-w-48 truncate whitespace-nowrap px-2 py-1 {cell === null ? 'italic text-text-muted' : ''}">{cell ?? "NULL"}</td>{/each}</tr>
                  {/each}
                </tbody>
              </table>
              {#if rowCount > 100}<p class="mt-2 text-[10px] text-text-muted">Showing first 100 of {rowCount} rows</p>{/if}
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
