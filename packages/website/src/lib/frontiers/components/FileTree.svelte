<script lang="ts">
  import type { VfsFile } from "$frontiers/virtual-fs.js";

  let {
    files,
    activeFilePath = $bindable(""),
    oncreate,
    ondelete,
  }: {
    files: VfsFile[];
    activeFilePath: string;
    oncreate: (path: string) => void;
    ondelete: (path: string) => void;
  } = $props();

  let newFileName = $state("");
  let showNewFile = $state(false);

  function fileName(path: string) {
    return path.split("/").pop() ?? path;
  }

  function fileDir(path: string) {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  }

  function groupedFiles(fileList: VfsFile[]): Map<string, VfsFile[]> {
    const groups = new Map<string, VfsFile[]>();
    for (const f of fileList) {
      const dir = fileDir(f.path) || "/";
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(f);
    }
    return groups;
  }

  function handleCreate() {
    if (!newFileName.trim()) return;
    oncreate(newFileName.trim());
    activeFilePath = newFileName.trim();
    newFileName = "";
    showNewFile = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
    if (e.key === "Escape") { showNewFile = false; newFileName = ""; }
  }
</script>

<div class="flex h-full flex-col">
  <div class="flex items-center justify-between border-b border-border px-3 py-1.5">
    <span class="text-[10px] font-medium uppercase tracking-wider text-text-muted">Files</span>
    <button
      class="text-xs text-text-muted hover:text-accent"
      onclick={() => (showNewFile = !showNewFile)}
      title="New file"
    >+</button>
  </div>
  {#if showNewFile}
    <div class="border-b border-border px-2 py-1">
      <input
        bind:value={newFileName}
        onkeydown={handleKeydown}
        class="w-full rounded border border-border-focus bg-surface-overlay px-1.5 py-0.5 text-[11px] text-text outline-none"
        placeholder="path/to/file.ts"
        spellcheck="false"
      />
    </div>
  {/if}
  <div class="flex-1 overflow-auto py-1">
    {#each [...groupedFiles(files)] as [dir, dirFiles]}
      <div class="px-2 pb-0.5 pt-2 text-[9px] font-medium uppercase tracking-wider text-text-muted">
        {dir}
      </div>
      {#each dirFiles as file}
        <div class="group flex items-center">
          <button
            class="flex-1 truncate px-3 py-0.5 text-left text-[11px] {activeFilePath === file.path
              ? 'bg-accent/15 text-accent'
              : 'text-text-muted hover:bg-surface-overlay hover:text-text'}"
            onclick={() => (activeFilePath = file.path)}
          >
            {fileName(file.path)}
          </button>
          <button
            class="hidden px-1 text-[10px] text-text-muted hover:text-error group-hover:block"
            onclick={() => ondelete(file.path)}
            title="Delete"
          >x</button>
        </div>
      {/each}
    {/each}
  </div>
</div>
