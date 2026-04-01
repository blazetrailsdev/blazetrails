<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SqlJsAdapter } from "../../sql-js-adapter.js";
  import type { VirtualFS } from "../../virtual-fs.js";

  interface Props {
    adapter: SqlJsAdapter;
    vfs: VirtualFS;
  }

  let { adapter, vfs }: Props = $props();

  interface TableInfo {
    name: string;
    rowCount: number;
    columns: Array<{ name: string; type: string; notnull: boolean; pk: boolean }>;
  }

  let tables = $state<TableInfo[]>([]);
  let expandedTable = $state<string | null>(null);

  function refresh() {
    const tableNames = adapter
      .getTables()
      .filter((t) => !t.startsWith("_vfs_"))
      .sort();
    tables = tableNames.map((name) => {
      const columns = adapter.getColumns(name);
      let rowCount = 0;
      try {
        const result = adapter.execRaw(
          `SELECT COUNT(*) FROM "${name.replace(/"/g, '""')}"`,
        );
        rowCount = (result[0]?.values[0]?.[0] as number) ?? 0;
      } catch {
        // table may not exist yet
      }
      return { name, rowCount, columns };
    });
  }

  let unsubscribe: (() => void) | undefined;
  onMount(() => {
    refresh();
    unsubscribe = vfs.onChange(() => refresh());
  });
  onDestroy(() => unsubscribe?.());

  function toggleTable(name: string) {
    expandedTable = expandedTable === name ? null : name;
  }
</script>

<div
  class="flex h-full flex-col overflow-auto text-xs"
  data-testid="database-browser"
>
  <div class="border-b border-border px-3 py-1.5">
    <span class="text-[10px] font-medium uppercase tracking-wider text-text-muted">Database</span>
  </div>

  {#if tables.length === 0}
    <div class="px-3 py-4 text-center text-text-muted" data-testid="db-empty">
      No tables yet. Run a migration to create tables.
    </div>
  {:else}
    {#each tables as table (table.name)}
      <div data-testid="db-table" data-table={table.name}>
        <button
          type="button"
          tabindex="-1"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:text-accent md:py-1
                 {expandedTable === table.name ? 'bg-surface-overlay text-text' : 'text-text-muted'}"
          onclick={() => toggleTable(table.name)}
        >
          <span class="w-3 text-[10px] text-text-muted" aria-hidden="true">
            {expandedTable === table.name ? "▼" : "▶"}
          </span>
          <span class="flex-1 truncate font-medium">{table.name}</span>
          <span class="text-[10px] text-text-muted">{table.rowCount} rows</span>
        </button>

        {#if expandedTable === table.name}
          <div class="border-b border-border pb-1">
            {#each table.columns as col}
              <div
                class="flex items-center gap-2 px-3 py-0.5"
                style="padding-left: 32px"
                data-testid="db-column"
              >
                <span class="text-text">{col.name}</span>
                <span class="text-[10px] text-info">{col.type || "ANY"}</span>
                {#if col.pk}
                  <span class="rounded bg-accent px-1 py-0 text-[9px] text-surface">PK</span>
                {/if}
                {#if col.notnull}
                  <span class="rounded bg-warning px-1 py-0 text-[9px] text-surface">NOT NULL</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>
