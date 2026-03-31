<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type * as Monaco from "monaco-editor";
  import type { VirtualFS } from "./virtual-fs.js";
  import { initTranspiler, transpile } from "./transpiler.js";
  import type { CompiledCache } from "./compiled-cache.js";
  import blazetrailsDts from "./blazetrails.d.ts?raw";
  import { SANDBOX_GLOBALS_DTS } from "./sandbox-globals.d.ts.js";

  let {
    filePath = $bindable(""),
    vfs,
    compiledCache,
    onrun,
    onsave,
  }: {
    filePath: string;
    vfs: VirtualFS | null;
    compiledCache?: CompiledCache | null;
    onrun?: () => void;
    onsave?: (path: string, content: string) => void;
  } = $props();

  let container: HTMLDivElement | undefined = $state();
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let monacoRef: typeof Monaco | undefined;
  let models = new Map<string, Monaco.editor.ITextModel>();
  let dirty = $state(false);

  function getOrCreateModel(path: string, content: string, language: string) {
    if (!monacoRef) return null;
    let model = models.get(path);
    if (model && !model.isDisposed()) {
      return model;
    }
    const uri = monacoRef.Uri.parse(`file:///${path}`);
    model = monacoRef.editor.getModel(uri) ?? monacoRef.editor.createModel(content, language, uri);
    models.set(path, model);
    return model;
  }

  function switchToFile(path: string) {
    if (!editor || !vfs || !monacoRef) return;
    const file = vfs.read(path);
    if (!file) return;
    const model = getOrCreateModel(path, file.content, file.language);
    if (model) {
      editor.setModel(model);
      dirty = false;
    }
  }

  async function saveCurrentFile() {
    if (!editor || !vfs || !filePath) return;
    const content = editor.getValue();
    vfs.write(filePath, content);
    dirty = false;

    // Compile .ts files for the dev server
    if (compiledCache && filePath.endsWith(".ts")) {
      try {
        const js = await transpile(content, filePath);
        const hash = String(content.length) + "-" + content.slice(0, 50);
        compiledCache.set(filePath, js, hash);
      } catch {
        // Compilation failed, SW will fall back to regex stripping
      }
    }

    onsave?.(filePath, content);
  }

  export function getValue(): string {
    return editor?.getValue() ?? "";
  }

  onMount(async () => {
    await import("./monaco-workers.js");
    const monaco = await import("monaco-editor");
    monacoRef = monaco;

    monaco.editor.defineTheme("frontiers-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "756D62", fontStyle: "italic" },
        { token: "keyword", foreground: "6B9E50" },
        { token: "string", foreground: "D4A04A" },
        { token: "number", foreground: "D4A04A" },
        { token: "type", foreground: "5B96B5" },
        { token: "variable", foreground: "E4DED4" },
        { token: "function", foreground: "E4DED4" },
      ],
      colors: {
        "editor.background": "#1C1916",
        "editor.foreground": "#E4DED4",
        "editor.lineHighlightBackground": "#272320",
        "editor.selectionBackground": "#6B9E5025",
        "editorCursor.foreground": "#6B9E50",
        "editorLineNumber.foreground": "#55504A",
        "editorLineNumber.activeForeground": "#A59D91",
        "editorWidget.background": "#272320",
        "editorWidget.border": "#4A433B",
        "editorSuggestWidget.background": "#272320",
        "editorSuggestWidget.border": "#4A433B",
        "editorSuggestWidget.selectedBackground": "#353029",
      },
    });

    monaco.editor.defineTheme("frontiers-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "756D62", fontStyle: "italic" },
        { token: "keyword", foreground: "3D6E28" },
        { token: "string", foreground: "A07830" },
        { token: "number", foreground: "A07830" },
        { token: "type", foreground: "2E6B85" },
        { token: "variable", foreground: "2A2520" },
        { token: "function", foreground: "2A2520" },
      ],
      colors: {
        "editor.background": "#F3EEE8",
        "editor.foreground": "#2A2520",
        "editor.lineHighlightBackground": "#EAE4DB",
        "editor.selectionBackground": "#3D6E2820",
        "editorCursor.foreground": "#3D6E28",
        "editorLineNumber.foreground": "#B0A99E",
        "editorLineNumber.activeForeground": "#6B6055",
        "editorWidget.background": "#FAF8F5",
        "editorWidget.border": "#CFC7BB",
        "editorSuggestWidget.background": "#FAF8F5",
        "editorSuggestWidget.border": "#CFC7BB",
        "editorSuggestWidget.selectedBackground": "#EAE4DB",
      },
    });

    function getMonacoTheme() {
      return document.documentElement.getAttribute("data-theme") === "light" ? "frontiers-light" : "frontiers-dark";
    }

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      editor?.updateOptions({ theme: getMonacoTheme() });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2022,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.Classic,
      allowNonTsExtensions: true,
      strict: true,
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      SANDBOX_GLOBALS_DTS,
      "blazetrails-globals.d.ts",
    );

    // Load generated BlazeTrails package type declarations
    if (blazetrailsDts) {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        blazetrailsDts,
        "blazetrails-packages.d.ts",
      );
    }

    // Create editor (model set separately)
    editor = monaco.editor.create(container!, {
      theme: getMonacoTheme(),
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      padding: { top: 12 },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      renderLineHighlight: "gutter",
      cursorBlinking: "smooth",
      smoothScrolling: true,
    });

    editor.onDidChangeModelContent(() => {
      dirty = true;
    });

    // Ctrl+S saves to VFS
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCurrentFile();
    });

    // Ctrl+Enter runs
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      saveCurrentFile();
      onrun?.();
    });

    // Init transpiler for compiled cache
    initTranspiler(monaco);

    // Load initial file
    if (filePath && vfs) {
      switchToFile(filePath);
    }
  });

  // React to filePath changes
  $effect(() => {
    if (filePath && editor && vfs) {
      switchToFile(filePath);
    }
  });

  onDestroy(() => {
    editor?.dispose();
    for (const model of models.values()) {
      if (!model.isDisposed()) model.dispose();
    }
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={container} class="h-full w-full"></div>
  {#if dirty}
    <div class="absolute right-3 top-0 rounded-b bg-surface-overlay px-2 py-0.5 text-[10px] text-text-muted">
      unsaved
    </div>
  {/if}
</div>
