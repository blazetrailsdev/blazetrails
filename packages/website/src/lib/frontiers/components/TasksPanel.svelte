<script lang="ts">
  import { onMount } from "svelte";
  import type { Runtime, MigrationStatus } from "$frontiers/runtime.js";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let { runtime, onchange }: { runtime: Runtime; onchange: () => void } = $props();

  let migrationStatuses: MigrationStatus[] = $state([]);
  let taskRunning = $state(false);
  let taskHistory: Array<{ command: string; output: string[]; success: boolean; timestamp: number }> = $state([]);
  let rollbackSteps = $state(1);
  let customCommand = $state("");
  let confirmAction = $state<{ command: string } | null>(null);
  let inputEl: HTMLInputElement | undefined = $state();
  let historyIndex = $state(-1);
  let commandHistory: string[] = $state([]);

  onMount(() => {
    refreshStatus();
    inputEl?.focus();
  });

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  async function refreshStatus() {
    migrationStatuses = await runtime.dbMigrateStatus();
  }

  async function runCommand(command: string) {
    if (taskRunning || !command.trim()) return;
    taskRunning = true;
    commandHistory = [command, ...commandHistory.filter((c) => c !== command)];
    historyIndex = -1;
    try {
      const result = await runtime.exec(command);
      taskHistory = [{ command, output: result.output, success: result.success, timestamp: Date.now() }, ...taskHistory];
    } catch (e: any) {
      taskHistory = [{ command, output: [e.message], success: false, timestamp: Date.now() }, ...taskHistory];
    } finally {
      taskRunning = false;
      await refreshStatus();
      onchange();
    }
  }

  function runDestructive(command: string) {
    confirmAction = { command };
  }

  async function executeConfirmed() {
    if (!confirmAction) return;
    await runCommand(confirmAction.command);
    confirmAction = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (customCommand.trim().startsWith("db:drop") || customCommand.trim().startsWith("db:reset")) {
        runDestructive(customCommand);
      } else {
        runCommand(customCommand);
      }
      customCommand = "";
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        customCommand = commandHistory[historyIndex];
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        customCommand = commandHistory[historyIndex];
      } else {
        historyIndex = -1;
        customCommand = "";
      }
    }
  }
</script>

<div class="flex h-full flex-col gap-3">
  <!-- CLI input — front and center -->
  <div class="rounded border border-border bg-surface p-3">
    <div class="mb-2 text-[10px] text-text-muted">
      Try: <button class="text-accent hover:underline" onclick={() => { customCommand = "sample bookstore"; inputEl?.focus(); }}>sample bookstore</button>
      | <button class="text-accent hover:underline" onclick={() => { customCommand = "new my-app"; inputEl?.focus(); }}>new my-app</button>
      | <button class="text-accent hover:underline" onclick={() => { customCommand = "scaffold Post title:string body:text"; inputEl?.focus(); }}>scaffold Post ...</button>
      | <button class="text-accent hover:underline" onclick={() => { customCommand = "sql SELECT * FROM sqlite_master"; inputEl?.focus(); }}>sql ...</button>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="text-sm text-accent">$</span>
      <input
        bind:this={inputEl}
        bind:value={customCommand}
        onkeydown={handleKeydown}
        class="flex-1 bg-transparent font-mono text-sm text-text outline-none"
        placeholder="new my-app"
        spellcheck="false"
        disabled={taskRunning}
      />
      {#if taskRunning}
        <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
      {/if}
    </div>
  </div>

  <!-- Quick action buttons -->
  <div class="flex flex-wrap gap-1.5">
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runCommand("db:setup")} disabled={taskRunning}>db:setup</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runCommand("db:migrate")} disabled={taskRunning}>db:migrate</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runCommand(`db:rollback --step ${rollbackSteps}`)} disabled={taskRunning}>db:rollback</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runCommand("db:migrate:status")} disabled={taskRunning}>db:migrate:status</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runCommand("db:seed")} disabled={taskRunning}>db:seed</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runDestructive("db:reset")} disabled={taskRunning}>db:reset</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-error hover:text-error disabled:opacity-50" onclick={() => runDestructive("db:drop")} disabled={taskRunning}>db:drop</button>
    <button class="rounded border border-border px-2 py-1 text-[10px] text-text-muted hover:border-accent hover:text-accent disabled:opacity-50" onclick={() => runCommand("db:schema:dump")} disabled={taskRunning}>db:schema:dump</button>
  </div>

  <!-- Migration status -->
  {#if migrationStatuses.length > 0}
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-medium text-text-muted">Migrations</span>
        <button class="text-[10px] text-text-muted hover:text-accent" onclick={refreshStatus}>refresh</button>
      </div>
      <table class="w-full text-[11px]">
        <tbody>
          {#each migrationStatuses as m}
            <tr class="border-b border-border/30">
              <td class="py-0.5 pr-2"><span class="rounded px-1 py-0.5 text-[9px] font-medium {m.status === 'up' ? 'bg-success/20 text-success' : 'bg-surface-overlay text-text-muted'}">{m.status}</span></td>
              <td class="py-0.5 pr-2 font-mono text-text-muted">{m.version}</td>
              <td class="py-0.5 text-text">{m.name}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- History -->
  <div class="flex-1 space-y-2 overflow-auto">
    {#each taskHistory as entry}
      <div class="rounded border {entry.success ? 'border-border/50' : 'border-error/30'} bg-surface-overlay p-2">
        <div class="flex items-center gap-2">
          <span class="text-[10px] {entry.success ? 'text-success' : 'text-error'}">{entry.success ? "OK" : "ERR"}</span>
          <span class="font-mono text-[11px] text-text">$ {entry.command}</span>
          <span class="text-[9px] text-text-muted">{formatTime(entry.timestamp)}</span>
        </div>
        {#if entry.output.length > 0}
          <pre class="mt-1 max-h-40 overflow-auto text-[10px] text-text-muted">{entry.output.join("\n")}</pre>
        {/if}
      </div>
    {/each}
  </div>
</div>

{#if confirmAction}
  <ConfirmDialog
    message={`Run ${confirmAction.command}? This is destructive.`}
    confirmLabel={confirmAction.command}
    onconfirm={executeConfirmed}
    oncancel={() => (confirmAction = null)}
  />
{/if}
