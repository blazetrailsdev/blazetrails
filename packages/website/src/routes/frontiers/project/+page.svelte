<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { createSwClient, type SwClient } from "$lib/frontiers/sw-client.js";
  import { SwVfsProxy } from "$lib/frontiers/sw-vfs-proxy.js";
  import { SwAdapterProxy } from "$lib/frontiers/sw-adapter-proxy.js";
  import { SwRuntimeProxy } from "$lib/frontiers/sw-runtime-proxy.js";
  import { SyncSwVfs } from "$lib/frontiers/sync-sw-vfs.js";
  import { SyncSwAdapter } from "$lib/frontiers/sync-sw-adapter.js";
  import type { CliResult } from "$lib/frontiers/trail-cli.js";
  import FileTree from "$lib/frontiers/components/sandbox/FileTree.svelte";
  import MonacoEditor from "$lib/frontiers/components/sandbox/MonacoEditor.svelte";
  import DatabaseBrowser from "$lib/frontiers/components/sandbox/DatabaseBrowser.svelte";
  import TabPanel from "$lib/frontiers/components/sandbox/TabPanel.svelte";
  import PreviewPanel from "$lib/frontiers/components/sandbox/PreviewPanel.svelte";

  let client = $state<SwClient | null>(null);
  let vfs = $state<SyncSwVfs | null>(null);
  let adapter = $state<SyncSwAdapter | null>(null);
  let runtimeProxy = $state<SwRuntimeProxy | null>(null);
  let previewPanel = $state<PreviewPanel | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let selectedFile = $state<{ path: string; content: string } | null>(null);
  let activeTab = $state("editor");

  let cliInput = $state("");
  let cliOutput = $state<string[]>([]);
  let cliRunning = $state(false);
  let cliOutputEl: HTMLDivElement | undefined = $state();

  const TABS = [
    { id: "editor", label: "Editor" },
    { id: "database", label: "Database" },
    { id: "preview", label: "Preview" },
  ];

  onMount(async () => {
    try {
      const sw = await createSwClient();
      client = sw;

      const vfsProxy = new SwVfsProxy(sw);
      const adapterProxy = new SwAdapterProxy(sw);
      runtimeProxy = new SwRuntimeProxy(sw);

      const syncVfs = new SyncSwVfs(vfsProxy);
      const syncAdapter = new SyncSwAdapter(adapterProxy, sw);

      await syncVfs.hydrate();
      await syncAdapter.hydrate();

      vfs = syncVfs;
      adapter = syncAdapter;

      // Auto-scaffold a new app if VFS is empty
      if (syncVfs.list().length === 0) {
        loading = false;
        await scaffoldNewApp();
      } else {
        loading = false;
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
    }
  });

  onDestroy(() => {
    clearTimeout(writeTimer);
    vfs?.dispose();
    adapter?.dispose();
    client?.destroy();
  });

  async function scaffoldNewApp() {
    if (!runtimeProxy) return;
    cliOutput = ["$ new myapp", "Creating new trails application..."];
    cliRunning = true;
    try {
      const result = await runtimeProxy.exec("new myapp");
      cliOutput = [...cliOutput, ...result.output];
    } catch (e: unknown) {
      cliOutput = [...cliOutput, `Error: ${e instanceof Error ? e.message : String(e)}`];
    } finally {
      cliRunning = false;
    }
  }

  function handleFileSelect(path: string) {
    if (!vfs) return;
    const file = vfs.read(path);
    if (file) {
      selectedFile = { path: file.path, content: file.content };
      activeTab = "editor";
    }
  }

  // Debounce editor writes — 300ms after last keystroke
  let writeTimer: ReturnType<typeof setTimeout>;

  function handleFileChange(content: string) {
    if (!vfs || !selectedFile) return;
    selectedFile = { ...selectedFile, content };
    clearTimeout(writeTimer);
    const path = selectedFile.path;
    writeTimer = setTimeout(() => {
      vfs?.write(path, content);
    }, 300);
  }

  async function runCommand() {
    const cmd = cliInput.trim();
    if (!cmd || !runtimeProxy || cliRunning) return;

    cliRunning = true;
    cliOutput = [...cliOutput, `$ ${cmd}`];
    cliInput = "";

    try {
      const result: CliResult = await runtimeProxy.exec(cmd);
      cliOutput = [...cliOutput, ...result.output];
      if (!result.success) {
        cliOutput = [...cliOutput, `Exit code: ${result.exitCode}`];
      }
    } catch (e: unknown) {
      cliOutput = [...cliOutput, `Error: ${e instanceof Error ? e.message : String(e)}`];
    } finally {
      cliRunning = false;
      previewPanel?.refresh();
    }
  }

  // Auto-scroll CLI output to bottom
  $effect(() => {
    if (cliOutput.length && cliOutputEl) {
      tick().then(() => {
        cliOutputEl?.scrollTo(0, cliOutputEl.scrollHeight);
      });
    }
  });

  // Re-read the selected file when VFS changes (e.g. after CLI generates files)
  $effect(() => {
    if (vfs && selectedFile) {
      const updated = vfs.read(selectedFile.path);
      if (updated && updated.content !== selectedFile.content) {
        selectedFile = { path: updated.path, content: updated.content };
      }
    }
  });
</script>

<svelte:head>
  <title>Project | Frontiers</title>
</svelte:head>

{#if loading}
  <div class="flex h-screen items-center justify-center bg-surface">
    <div class="text-center">
      <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
      <p class="mt-2 text-sm text-text-muted">Starting sandbox…</p>
    </div>
  </div>
{:else if error}
  <div class="flex h-screen items-center justify-center bg-surface">
    <div class="rounded border border-error bg-surface-raised p-6 text-center">
      <p class="text-sm text-error">Failed to start sandbox</p>
      <p class="mt-1 text-xs text-text-muted">{error}</p>
      <p class="mt-2 text-xs text-text-muted">Service workers require HTTPS or localhost.</p>
    </div>
  </div>
{:else if vfs && adapter && client}
  <div class="flex h-screen flex-col bg-surface">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-border px-4 py-2">
      <div class="flex items-center gap-3">
        <a href="/frontiers" class="text-xs text-text-muted hover:text-accent">← Frontiers</a>
        <h1 class="text-sm font-medium text-text">Sandbox</h1>
      </div>
    </div>

    <!-- Main content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar: FileTree -->
      <div class="w-56 flex-shrink-0 overflow-hidden border-r border-border">
        <FileTree
          {vfs}
          selectedPath={selectedFile?.path ?? ""}
          onselect={handleFileSelect}
        />
      </div>

      <!-- Main pane: TabPanel -->
      <div class="flex flex-1 flex-col overflow-hidden">
        <TabPanel tabs={TABS} bind:activeTab>
          {#snippet children(tab)}
            {#if tab === "editor"}
              <MonacoEditor
                file={selectedFile}
                onchange={handleFileChange}
              />
            {:else if tab === "database"}
              <DatabaseBrowser
                {adapter}
                {vfs}
              />
            {:else if tab === "preview"}
              <PreviewPanel bind:this={previewPanel} {client} />
            {/if}
          {/snippet}
        </TabPanel>
      </div>
    </div>

    <!-- CLI bar -->
    <div class="border-t border-border bg-surface-raised">
      {#if cliOutput.length > 0}
        <div bind:this={cliOutputEl} class="max-h-32 overflow-y-auto px-4 py-2">
          {#each cliOutput as line}
            <pre class="text-[11px] leading-relaxed text-text-muted">{line}</pre>
          {/each}
        </div>
      {/if}
      <div class="flex items-center gap-2 px-4 py-2">
        <span class="text-xs text-text-muted">$</span>
        <input
          bind:value={cliInput}
          onkeydown={(e) => { if (e.key === "Enter") runCommand(); }}
          class="flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text-muted"
          placeholder="generate model User name:string email:string"
          disabled={cliRunning}
          spellcheck="false"
        />
        {#if cliRunning}
          <span class="inline-block h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent"></span>
        {/if}
      </div>
    </div>
  </div>
{/if}
