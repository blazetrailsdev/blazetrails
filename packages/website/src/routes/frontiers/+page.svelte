<script lang="ts">
  import { onMount } from "svelte";
  import { Splitpanes, Pane } from "svelte-splitpanes";
  import { examples } from "$frontiers/examples/index.js";
  import type { Runtime, VfsFile } from "$frontiers/runtime.js";
  import { ProjectStore, type ProjectMeta } from "$frontiers/project-store.js";
  import type { DevServer } from "$frontiers/dev-server.js";
  import { createPreviewServer, type PreviewServer } from "$frontiers/preview-server.js";
  import { shareProject, loadSharedProject, setApiBase, copyToClipboard } from "$frontiers/share.js";
  import type { Template } from "$frontiers/templates.js";
  import FileTree from "$frontiers/components/FileTree.svelte";
  import ProjectSwitcher from "$frontiers/components/ProjectSwitcher.svelte";
  import DatabaseBrowser from "$frontiers/components/DatabaseBrowser.svelte";
  import TasksPanel from "$frontiers/components/TasksPanel.svelte";
  import SqlConsole from "$frontiers/components/SqlConsole.svelte";
  import Repl from "$frontiers/components/Repl.svelte";
  import ConsolePanel from "$frontiers/components/ConsolePanel.svelte";
  import PreviewPanel from "$frontiers/components/PreviewPanel.svelte";
  import ResultsPanel from "$frontiers/components/ResultsPanel.svelte";
  import AuthButton from "$frontiers/components/AuthButton.svelte";
  import ConfirmDialog from "$frontiers/components/ConfirmDialog.svelte";
  import FileSwitcher from "$frontiers/components/FileSwitcher.svelte";
  import CommandPalette from "$frontiers/components/CommandPalette.svelte";
  import type { Command } from "$frontiers/components/CommandPalette.svelte";
  import TabBar from "$frontiers/components/TabBar.svelte";
  import ThemeToggle from "$frontiers/components/ThemeToggle.svelte";
  import HistoryPanel from "$frontiers/components/HistoryPanel.svelte";

  // Core state
  let runtime: Runtime | null = $state(null);
  let loading = $state(true);
  let error = $state("");
  let MonacoEditor: any = $state(null);
  let devServer: DevServer | null = $state(null);
  let previewSrv: PreviewServer | null = $state(null);
  let autoSaveTimer: ReturnType<typeof setInterval> | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  // Project state
  const store = new ProjectStore();
  let projects: ProjectMeta[] = $state([]);
  let currentProject = $state("");
  let sharing = $state(false);
  let shareUrl = $state("");
  let apiBase = $state<string | null>(null);
  let userEmail = $state<string | null>(null);

  // File state
  let files: VfsFile[] = $state([]);
  let activeFilePath = $state("README.md");
  let openFiles: string[] = $state(["README.md"]);

  // Embed mode
  let embedMode = $state(false);

  // Overlays
  let showFileSwitcher = $state(false);
  let showCommandPalette = $state(false);

  // Tab state
  type RightTab = "results" | "preview" | "database" | "tasks" | "history" | "sql" | "repl";
  let activeTab: RightTab = $state("tasks");

  // Execution state
  let resultOutput = $state("");
  let resultError = $state("");
  let executing = $state(false);

  // Console
  let consolePanel: ConsolePanel | undefined = $state();
  let consoleLines: Array<{ type: "info" | "error" | "success" | "warn" | "log"; text: string; timestamp: number }> = $state([]);

  // Component refs
  let dbBrowser: DatabaseBrowser | undefined = $state();
  let previewPanel: PreviewPanel | undefined = $state();
  let historyPanel: HistoryPanel | undefined = $state();

  // Shared project state (for fork)
  let isSharedView = $state(false);

  // Confirm dialog
  let confirmState = $state<{ message: string; onconfirm: () => void } | null>(null);

  // Commands for the palette
  const commands: Command[] = $derived([
    { id: "run", label: "Run Current File", shortcut: "Ctrl+Enter", action: runCurrentFile },
    { id: "save-project", label: "Save Project", action: saveProject },
    { id: "share", label: "Share / Publish", action: publishProject },
    { id: "new-project", label: "Trail New", action: () => {} },
    { id: "reset-db", label: "Reset Database", action: resetDB },
    { id: "db-migrate", label: "db:migrate", action: () => runtime?.dbMigrate().then(afterChange) },
    { id: "db-rollback", label: "db:rollback", action: () => runtime?.dbRollback().then(afterChange) },
    { id: "db-setup", label: "db:setup", action: () => runtime?.dbSetup().then(afterChange) },
    { id: "snapshot", label: "Save Snapshot", action: () => { runtime?.history.save(runtime!.exportDB(), new Date().toLocaleString()); historyPanel?.refresh(); log("info", "Snapshot saved"); } },
    { id: "fork", label: "Fork Project", action: forkProject },
    { id: "export", label: "Export .sqlite", action: exportProject },
    { id: "tab-results", label: "Show Results", action: () => (activeTab = "results") },
    { id: "tab-preview", label: "Show Preview", action: () => (activeTab = "preview") },
    { id: "tab-database", label: "Show Database", action: () => (activeTab = "database") },
    { id: "tab-tasks", label: "Show Tasks", action: () => (activeTab = "tasks") },
    { id: "tab-sql", label: "Show SQL Console", action: () => (activeTab = "sql") },
    { id: "tab-repl", label: "Show REPL", action: () => (activeTab = "repl") },
  ]);

  function log(type: "info" | "error" | "success" | "warn" | "log", text: string) {
    consoleLines = [...consoleLines, { type, text, timestamp: Date.now() }];
  }

  function captureConsole<T>(fn: () => T): T {
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
    console.log = (...a: unknown[]) => log("log", a.map(fv).join(" "));
    console.warn = (...a: unknown[]) => log("warn", a.map(fv).join(" "));
    console.error = (...a: unknown[]) => log("error", a.map(fv).join(" "));
    console.info = (...a: unknown[]) => log("info", a.map(fv).join(" "));
    try { return fn(); } finally { Object.assign(console, orig); }
  }

  function fv(v: unknown): string {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return v;
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }

  // --- Lifecycle ---

  onMount(async () => {
    const [monacoMod, runtimeMod] = await Promise.all([
      import("$frontiers/Monaco.svelte"),
      import("$frontiers/runtime.js"),
    ]);
    MonacoEditor = monacoMod.default;

    try {
      embedMode = new URLSearchParams(location.search).has("embed");
      apiBase = import.meta.env.VITE_FRONTIERS_API || null;
      if (apiBase) setApiBase(apiBase);

      let initialData: Uint8Array | undefined;
      const shared = await loadSharedProject();
      if (shared) {
        initialData = shared.data;
        currentProject = shared.name;
        isSharedView = true;
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      } else {
        projects = await store.list();
        const last = localStorage.getItem("frontiers:lastProject");
        if (last && await store.exists(last)) {
          const data = await store.load(last);
          if (data) { initialData = data; currentProject = last; }
        }
      }

      runtime = await runtimeMod.createRuntime(initialData);
      refreshFiles();
      openFiles = files.length > 0 ? [files[0].path] : [];
      activeFilePath = openFiles[0] ?? "";

      try {
        const { createDevServer } = await import("$frontiers/dev-server.js");
        devServer = await createDevServer();
        devServer.onUpdate(() => log("warn", "A new version is available. Refresh to update."));
        syncDevServer();
        log("success", "Dev server started at /~dev/");
      } catch (e: any) {
        // SW failed (non-HTTPS, unsupported, etc.) — use blob-based preview
        previewSrv = createPreviewServer(runtime.vfs, runtime.compiled);
        log("info", "Preview using blob mode (service worker unavailable)");
      }

      log("success", currentProject ? `Opened "${currentProject}"` : "Runtime initialized");
      autoSaveTimer = setInterval(autoSave, 10000);
    } catch (e: any) {
      error = e.message;
      log("error", `Failed to initialize: ${e.message}`);
    }
    loading = false;

    // Global keyboard shortcuts
    function handleGlobalKeydown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        showFileSwitcher = !showFileSwitcher;
        showCommandPalette = false;
      }
      if (mod && e.shiftKey && e.key === "P") {
        e.preventDefault();
        showCommandPalette = !showCommandPalette;
        showFileSwitcher = false;
      }
    }
    window.addEventListener("keydown", handleGlobalKeydown);

    return () => {
      if (autoSaveTimer) clearInterval(autoSaveTimer);
      devServer?.destroy();
      window.removeEventListener("keydown", handleGlobalKeydown);
    };
  });

  // --- Sync ---

  function syncDevServer() {
    if (!runtime) return;
    const bytes = runtime.exportDB();
    if (devServer) devServer.sync(bytes);
    if (currentProject) {
      clearTimeout(persistTimer);
      persistTimer = setTimeout(() => store.save(currentProject, bytes).catch(() => {}), 100);
    }
  }

  function afterChange() {
    dbBrowser?.refresh();
    refreshFiles();
    syncDevServer();
  }

  function refreshFiles() { if (runtime) files = runtime.vfs.list(); }
  async function autoSave() { if (runtime && currentProject) await store.save(currentProject, runtime.exportDB()).catch(() => {}); }

  // --- File operations ---

  function openFile(path: string) {
    activeFilePath = path;
    if (!openFiles.includes(path)) openFiles = [...openFiles, path];
  }

  async function runCurrentFile() {
    if (!runtime || executing) return;
    const file = runtime.vfs.read(activeFilePath);
    if (!file) return;

    executing = true;
    resultError = "";
    resultOutput = "";
    log("info", `Running ${activeFilePath}...`);
    const start = performance.now();
    try {
      const result = await captureConsole(() => runtime!.executeCode(file.content));
      resultOutput = fv(await result);
      log("success", `${activeFilePath} completed in ${(performance.now() - start).toFixed(1)}ms`);
      activeTab = "results";
    } catch (e: any) {
      resultError = e.stack || e.message;
      log("error", e.message);
    } finally {
      executing = false;
      afterChange();
    }
  }

  function handleFileSave(path: string, _content: string) {
    log("info", `Saved ${path}`);
    afterChange();
    if (/\.(html|css|ts|js)$/.test(path)) previewPanel?.refresh();
  }

  function createFile(path: string) {
    runtime?.vfs.write(path, "");
    refreshFiles();
    openFile(path);
  }

  function deleteFile(path: string) {
    confirmState = {
      message: `Delete "${path}"?`,
      onconfirm: () => {
        runtime?.vfs.delete(path);
        refreshFiles();
        openFiles = openFiles.filter((p) => p !== path);
        if (activeFilePath === path) activeFilePath = openFiles[0] ?? files[0]?.path ?? "";
        confirmState = null;
      },
    };
  }

  // --- Project operations ---

  async function refreshProjects() { projects = await store.list(); }

  async function trailNew(name: string, template?: Template) {
    if (!runtime) return;
    if (currentProject) await store.save(currentProject, runtime.exportDB());
    runtime.newProject();
    // If a template was selected (not the default), replace seed files
    if (template && template.name !== "blank") {
      // Clear default seeds and write template files
      for (const f of runtime.vfs.list()) runtime.vfs.delete(f.path);
      for (const f of template.files) runtime.vfs.write(f.path, f.content);
    }
    currentProject = name;
    localStorage.setItem("frontiers:lastProject", name);
    await store.save(name, runtime.exportDB());
    await refreshProjects();
    clearUIState();
    refreshFiles();
    openFiles = files.length > 0 ? [files[0].path] : [];
    activeFilePath = openFiles[0] ?? "";
    await reconnectDevServer();
    log("success", `Created "${name}"`);
  }

  async function openProject(name: string) {
    if (!runtime || name === currentProject) return;
    if (currentProject) await store.save(currentProject, runtime.exportDB());
    const data = await store.load(name);
    if (!data) { log("error", `"${name}" not found`); return; }
    runtime.loadDB(data);
    currentProject = name;
    localStorage.setItem("frontiers:lastProject", name);
    clearUIState();
    refreshFiles();
    openFiles = files.length > 0 ? [files[0].path] : [];
    activeFilePath = openFiles[0] ?? "";
    await reconnectDevServer();
    log("success", `Opened "${name}"`);
  }

  async function saveProject() {
    if (!runtime || !currentProject) return;
    await store.save(currentProject, runtime.exportDB());
    await refreshProjects();
    log("info", `Saved "${currentProject}"`);
  }

  async function saveProjectAs(name: string) {
    if (!runtime) return;
    currentProject = name;
    localStorage.setItem("frontiers:lastProject", name);
    await store.save(name, runtime.exportDB());
    await refreshProjects();
    log("success", `Saved as "${name}"`);
  }

  async function deleteProject(name: string) {
    await store.delete(name);
    await refreshProjects();
    if (currentProject === name) { currentProject = ""; localStorage.removeItem("frontiers:lastProject"); }
    log("info", `Deleted "${name}"`);
  }

  async function publishProject() {
    if (!runtime || sharing) return;
    sharing = true;
    try {
      const result = await shareProject(runtime.exportDB(), currentProject || "untitled");
      shareUrl = result.url;
      await copyToClipboard(result.url);
      log("success", `Shared! Link copied (${(result.size / 1024).toFixed(1)}KB)`);
    } catch (e: any) {
      log("error", `Share failed: ${e.message}`);
    } finally {
      sharing = false;
    }
  }

  function resetDB() {
    confirmState = {
      message: "Reset the database? All tables and data will be lost.",
      onconfirm: () => {
        runtime?.reset();
        clearUIState();
        consoleLines = [];
        refreshFiles();
        openFiles = files.length > 0 ? [files[0].path] : [];
        activeFilePath = openFiles[0] ?? "";
        log("info", "Database reset");
        confirmState = null;
      },
    };
  }

  function importProject(data: Uint8Array, name: string) {
    if (!runtime) return;
    runtime.loadDB(data);
    currentProject = name;
    localStorage.setItem("frontiers:lastProject", name);
    store.save(name, data).then(refreshProjects);
    clearUIState();
    refreshFiles();
    openFiles = files.length > 0 ? [files[0].path] : [];
    activeFilePath = openFiles[0] ?? "";
    reconnectDevServer();
    log("success", `Imported "${name}"`);
  }

  function exportProject() {
    if (!runtime) return;
    ProjectStore.downloadFile(currentProject || "untitled", runtime.exportDB());
    log("info", `Exported "${currentProject || "untitled"}.sqlite"`);
  }

  function forkProject() {
    if (!runtime) return;
    const forkName = `${currentProject || "untitled"}-fork`;
    const data = runtime.exportDB();
    store.save(forkName, data).then(refreshProjects);
    currentProject = forkName;
    localStorage.setItem("frontiers:lastProject", forkName);
    isSharedView = false;
    log("success", `Forked as "${forkName}"`);
  }

  function clearUIState() { resultOutput = ""; resultError = ""; }

  async function reconnectDevServer() {
    if (!runtime) return;
    if (devServer) {
      try {
        await devServer.destroy();
        const { createDevServer } = await import("$frontiers/dev-server.js");
        devServer = await createDevServer();
        syncDevServer();
      } catch { /* silent */ }
    }
    // Recreate blob preview server with new VFS
    if (!devServer?.connected) {
      previewSrv = createPreviewServer(runtime.vfs, runtime.compiled);
    }
    previewPanel?.refresh();
  }

  function loadExample(idx: number) {
    if (!runtime) return;
    const ex = examples[idx];
    const path = `scratch/${ex.name.toLowerCase().replace(/\s+/g, "-")}.ts`;
    runtime.vfs.write(path, ex.code);
    refreshFiles();
    openFile(path);
  }
</script>

<svelte:head>
  <style>
    .splitpanes { height: 100% !important; }
    .splitpanes__splitter { background: var(--color-border) !important; min-width: 2px !important; min-height: 2px !important; opacity: 0.5; transition: opacity 0.15s; }
    .splitpanes__splitter:hover { background: var(--color-accent) !important; opacity: 1; }
    .splitpanes--vertical > .splitpanes__splitter { width: 3px !important; }
    .splitpanes--horizontal > .splitpanes__splitter { height: 3px !important; }
  </style>
</svelte:head>

<div class="flex h-screen flex-col">
  <!-- Header -->
  {#if !embedMode}
  <header class="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-2">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-bold text-accent">Frontiers</h1>
      <ProjectSwitcher
        bind:currentProject {projects} {sharing}
        ontrailnew={trailNew} onopen={openProject} onsave={saveProject}
        onsaveas={saveProjectAs} ondelete={deleteProject} onpublish={publishProject}
        onimport={importProject} onexport={exportProject}
      />
    </div>
    <div class="flex items-center gap-2">
      <AuthButton {apiBase} onauth={(e) => (userEmail = e)} />
      <select
        class="rounded border border-border bg-surface-overlay px-2 py-1 text-xs text-text"
        onchange={(e) => { const i = (e.target as HTMLSelectElement).selectedIndex - 1; if (i >= 0) loadExample(i); (e.target as HTMLSelectElement).selectedIndex = 0; }}
      >
        <option>Examples</option>
        {#each examples as example}<option>{example.name}</option>{/each}
      </select>
      {#if isSharedView}
        <button class="rounded border border-accent bg-accent/10 px-2 py-1 text-xs text-accent hover:bg-accent/20" onclick={forkProject}>Fork</button>
      {/if}
      <button class="rounded border border-border px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50" onclick={publishProject} disabled={sharing}>
        {sharing ? "..." : "Share"}
      </button>
      {#if shareUrl}<span class="text-[10px] text-success">Copied!</span>{/if}
      <ThemeToggle />
      <button class="rounded border border-border px-2 py-1 text-xs text-text-muted hover:border-error hover:text-error" onclick={resetDB}>Reset</button>
    </div>
  </header>
  {/if}

  {#if loading}
    <div class="flex flex-1 flex-col items-center justify-center gap-3">
      <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
      <div class="text-sm text-text-muted">Initializing WASM runtime...</div>
    </div>
  {:else if error}
    <div class="flex flex-1 items-center justify-center"><div class="text-error">{error}</div></div>
  {:else if runtime}
    <div class="min-h-0 flex-1">
      <Splitpanes horizontal>
        <Pane minSize={20}>
          <Splitpanes>
            <!-- File tree -->
            {#if !embedMode}
            <Pane size={15} minSize={10} maxSize={25}>
              <div class="h-full bg-surface-raised">
                <FileTree {files} bind:activeFilePath oncreate={createFile} ondelete={deleteFile} />
              </div>
            </Pane>
            {/if}

            <!-- Editor -->
            <Pane size={45} minSize={20}>
              <div class="flex h-full flex-col">
                <TabBar bind:openFiles bind:activeFilePath />
                <div class="flex items-center justify-between border-b border-border bg-surface-raised px-3 py-1">
                  <span class="text-[10px] text-text-muted">{activeFilePath || "no file"}</span>
                  <button
                    class="rounded bg-accent px-2.5 py-0.5 text-[11px] font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
                    onclick={runCurrentFile} disabled={executing}
                  >
                    {executing ? "..." : "Run"}
                    <kbd class="ml-1 text-[9px] opacity-60">{navigator?.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter</kbd>
                  </button>
                </div>
                <div class="flex-1">
                  {#if MonacoEditor}
                    <MonacoEditor bind:filePath={activeFilePath} vfs={runtime.vfs} compiledCache={runtime.compiled} onrun={runCurrentFile} onsave={handleFileSave} />
                  {/if}
                </div>
              </div>
            </Pane>

            <!-- Right panel -->
            <Pane size={40} minSize={15}>
              <div class="flex h-full flex-col">
                <div class="flex border-b border-border bg-surface-raised">
                  {#each [["results", "Results"], ["preview", "Preview"], ["database", "Database"], ["tasks", "Tasks"], ["history", "History"], ["sql", "SQL"], ["repl", "REPL"]] as [tab, label]}
                    <button
                      class="px-2.5 py-1.5 text-[11px] transition-colors {activeTab === tab ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text'}"
                      onclick={() => (activeTab = tab as RightTab)}
                    >{label}</button>
                  {/each}
                </div>
                <div class="flex-1 overflow-auto p-3">
                  {#if activeTab === "results"}
                    <ResultsPanel output={resultOutput} error={resultError} {executing} />
                  {:else if activeTab === "preview"}
                    <PreviewPanel bind:this={previewPanel} {devServer} previewServer={previewSrv} onerror={(msg) => log("error", `[Preview] ${msg}`)} />
                  {:else if activeTab === "database"}
                    <DatabaseBrowser bind:this={dbBrowser} {runtime} />
                  {:else if activeTab === "tasks"}
                    <TasksPanel {runtime} onchange={afterChange} />
                  {:else if activeTab === "history"}
                    <HistoryPanel bind:this={historyPanel} {runtime} onrestore={() => { refreshFiles(); openFiles = files.length > 0 ? [files[0].path] : []; activeFilePath = openFiles[0] ?? ""; afterChange(); }} />
                  {:else if activeTab === "sql"}
                    <SqlConsole {runtime} onchange={afterChange} />
                  {:else if activeTab === "repl"}
                    <Repl {runtime} onchange={afterChange} />
                  {/if}
                </div>
              </div>
            </Pane>
          </Splitpanes>
        </Pane>

        <!-- Console -->
        {#if !embedMode}
        <Pane size={20} minSize={8} maxSize={40}>
          <ConsolePanel bind:this={consolePanel} bind:lines={consoleLines} />
        </Pane>
        {/if}
      </Splitpanes>
    </div>
  {/if}
</div>

<!-- Overlays -->
{#if showFileSwitcher}
  <FileSwitcher {files} onselect={openFile} onclose={() => (showFileSwitcher = false)} />
{/if}
{#if showCommandPalette}
  <CommandPalette {commands} onclose={() => (showCommandPalette = false)} />
{/if}
{#if confirmState}
  <ConfirmDialog message={confirmState.message} onconfirm={confirmState.onconfirm} oncancel={() => (confirmState = null)} />
{/if}
