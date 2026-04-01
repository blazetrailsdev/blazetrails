<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { VirtualFS } from "../../virtual-fs.js";

  interface Props {
    vfs: VirtualFS;
    selectedPath?: string;
    onselect?: (path: string) => void;
    readonly?: boolean;
  }

  let { vfs, selectedPath = "", onselect, readonly = false }: Props = $props();

  interface TreeNode {
    name: string;
    path: string;
    isDir: boolean;
    children: TreeNode[];
  }

  let root = $state<TreeNode[]>([]);
  let collapsed = $state<Set<string>>(new Set());
  let contextMenu = $state<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  let renaming = $state<string | null>(null);
  let renameValue = $state("");
  let creating = $state<{ parentDir: string; isDir: boolean } | null>(null);
  let createValue = $state("");
  let focusedPath = $state<string | null>(null);
  let confirmDelete = $state<{ path: string; isDir: boolean } | null>(null);

  function buildTree(paths: string[], hiddenPaths: Set<string> = new Set()): TreeNode[] {
    const nodeMap = new Map<string, TreeNode>();

    function ensureDir(dirPath: string): TreeNode {
      if (nodeMap.has(dirPath)) return nodeMap.get(dirPath)!;
      const parts = dirPath.split("/");
      const node: TreeNode = {
        name: parts[parts.length - 1],
        path: dirPath,
        isDir: true,
        children: [],
      };
      nodeMap.set(dirPath, node);
      if (parts.length > 1) {
        const parent = ensureDir(parts.slice(0, -1).join("/"));
        if (!parent.children.find((c) => c.path === dirPath)) {
          parent.children.push(node);
        }
      }
      return node;
    }

    const topLevel: TreeNode[] = [];

    for (const filePath of paths) {
      const parts = filePath.split("/");

      if (hiddenPaths.has(filePath)) {
        if (parts.length > 1) ensureDir(parts.slice(0, -1).join("/"));
        continue;
      }

      const fileName = parts[parts.length - 1];
      const fileNode: TreeNode = {
        name: fileName,
        path: filePath,
        isDir: false,
        children: [],
      };
      nodeMap.set(filePath, fileNode);

      if (parts.length > 1) {
        const parentDir = parts.slice(0, -1).join("/");
        const parent = ensureDir(parentDir);
        parent.children.push(fileNode);
      } else {
        topLevel.push(fileNode);
      }
    }

    for (const node of nodeMap.values()) {
      if (node.isDir) {
        const parts = node.path.split("/");
        if (parts.length === 1 && !topLevel.includes(node)) {
          topLevel.push(node);
        }
      }
    }

    function sortChildren(nodes: TreeNode[]): TreeNode[] {
      return nodes.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }

    function sortRecursive(nodes: TreeNode[]): TreeNode[] {
      for (const node of nodes) {
        if (node.isDir) node.children = sortRecursive(sortChildren(node.children));
      }
      return sortChildren(nodes);
    }

    return sortRecursive(topLevel);
  }

  function refresh() {
    const files = vfs.list();
    const paths = files.map((f) => f.path);
    root = buildTree(paths, new Set(
      paths.filter((p) => p === ".gitkeep" || p.endsWith("/.gitkeep")),
    ));
  }

  let unsubscribe: (() => void) | undefined;
  onMount(() => {
    refresh();
    unsubscribe = vfs.onChange(() => refresh());
  });
  onDestroy(() => unsubscribe?.());

  function toggleCollapse(path: string) {
    const next = new Set(collapsed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    collapsed = next;
  }

  function selectFile(path: string) {
    onselect?.(path);
  }

  function fileIcon(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "js":
        return "📄";
      case "json":
        return "⚙️";
      case "sql":
        return "🗃️";
      case "css":
        return "🎨";
      case "html":
      case "ejs":
        return "🌐";
      case "md":
        return "📝";
      default:
        return "📄";
    }
  }

  function showContextMenu(e: MouseEvent, path: string, isDir: boolean) {
    if (readonly) return;
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, path, isDir };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function startRename(path: string) {
    renaming = path;
    renameValue = path.split("/").pop() ?? "";
    closeContextMenu();
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (!renaming || !trimmed || trimmed.includes("/")) {
      renaming = null;
      return;
    }
    const parts = renaming.split("/");
    parts[parts.length - 1] = trimmed;
    const newPath = parts.join("/");
    if (newPath !== renaming) {
      const node = findNode(root, renaming);
      if (node?.isDir) {
        const prefix = renaming + "/";
        if (newPath.startsWith(prefix)) {
          renaming = null;
          return;
        }
        const allFiles = vfs.list();
        const filesToMove = allFiles.filter((f) => f.path.startsWith(prefix));
        const newPaths = filesToMove.map((f) => newPath + "/" + f.path.slice(prefix.length));
        const hasConflict =
          allFiles.some(
            (f) =>
              !f.path.startsWith(prefix) &&
              (f.path === newPath || f.path.startsWith(newPath + "/")),
          ) ||
          newPaths.some((np) =>
            allFiles.some((f) => f.path === np && !f.path.startsWith(prefix)),
          );
        if (hasConflict) {
          renaming = null;
          return;
        }
        for (let i = 0; i < filesToMove.length; i++) {
          vfs.rename(filesToMove[i].path, newPaths[i]);
        }
        if (selectedPath?.startsWith(prefix)) {
          onselect?.(newPath + "/" + selectedPath.slice(prefix.length));
        }
      } else {
        const renamed = vfs.rename(renaming, newPath);
        if (!renamed) {
          renaming = null;
          return;
        }
        if (selectedPath === renaming) onselect?.(newPath);
      }
    }
    renaming = null;
  }

  function startCreate(parentDir: string, isDir: boolean) {
    creating = { parentDir, isDir };
    createValue = "";
    closeContextMenu();
    if (collapsed.has(parentDir)) toggleCollapse(parentDir);
  }

  function commitCreate() {
    const name = createValue.trim();
    if (!creating || !name || name.includes("/")) {
      creating = null;
      return;
    }
    const dir = creating.parentDir;
    const fullPath = dir ? `${dir}/${name}` : name;
    if (vfs.exists(fullPath) || vfs.list().some((f) => f.path.startsWith(fullPath + "/"))) {
      creating = null;
      return;
    }
    if (creating.isDir) {
      vfs.write(`${fullPath}/.gitkeep`, "");
      creating = null;
      return;
    } else {
      vfs.write(fullPath, "");
      onselect?.(fullPath);
    }
    creating = null;
  }

  function requestDelete(path: string, isDir: boolean) {
    closeContextMenu();
    confirmDelete = { path, isDir };
  }

  function executeDelete() {
    if (!confirmDelete) return;
    const { path, isDir } = confirmDelete;
    if (isDir) {
      const files = vfs.list().filter((f) => f.path.startsWith(path + "/"));
      for (const f of files) vfs.delete(f.path);
    } else {
      vfs.delete(path);
    }
    confirmDelete = null;
  }

  function getAllVisiblePaths(): string[] {
    const paths: string[] = [];
    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        paths.push(node.path);
        if (node.isDir && !collapsed.has(node.path)) {
          walk(node.children);
        }
      }
    }
    walk(root);
    return paths;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (renaming || creating) return;
    const visible = getAllVisiblePaths();
    const idx = visible.indexOf(focusedPath ?? selectedPath);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = visible[Math.min(idx + 1, visible.length - 1)];
      if (next) focusedPath = next;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = visible[Math.max(idx - 1, 0)];
      if (prev) focusedPath = prev;
    } else if (e.key === "ArrowRight" && focusedPath) {
      const node = findNode(root, focusedPath);
      if (node?.isDir && collapsed.has(focusedPath)) {
        e.preventDefault();
        toggleCollapse(focusedPath);
      }
    } else if (e.key === "ArrowLeft" && focusedPath) {
      const node = findNode(root, focusedPath);
      if (node?.isDir && !collapsed.has(focusedPath)) {
        e.preventDefault();
        toggleCollapse(focusedPath);
      }
    } else if (e.key === "Enter" && focusedPath) {
      e.preventDefault();
      const node = findNode(root, focusedPath);
      if (node?.isDir) toggleCollapse(focusedPath);
      else selectFile(focusedPath);
    } else if (e.key === "F2" && focusedPath && !readonly) {
      e.preventDefault();
      startRename(focusedPath);
    } else if ((e.key === "Delete" || e.key === "Backspace") && focusedPath && !readonly) {
      e.preventDefault();
      const node = findNode(root, focusedPath);
      if (node) requestDelete(focusedPath, node.isDir);
    } else if (e.key === "Escape") {
      if (confirmDelete) confirmDelete = null;
      else if (contextMenu) closeContextMenu();
    }
  }

  function findNode(nodes: TreeNode[], path: string): TreeNode | null {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.isDir) {
        const found = findNode(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }
</script>

<svelte:window onclick={closeContextMenu} />

<div
  class="flex h-full flex-col overflow-auto text-xs"
  data-testid="file-tree"
  role="tree"
  aria-label="File explorer"
  aria-activedescendant={focusedPath ? `tree-item-${encodeURIComponent(focusedPath)}` : undefined}
  tabindex="0"
  onkeydown={handleKeydown}
>
  <div class="flex items-center justify-between border-b border-border px-3 py-1.5">
    <span class="text-[10px] font-medium uppercase tracking-wider text-text-muted">Files</span>
    {#if !readonly}
      <div class="flex gap-1">
        <button
          type="button"
          class="text-text-muted hover:text-accent"
          onclick={() => startCreate("", false)}
          title="New File"
          aria-label="New File"
          data-testid="new-file-button"
        >+</button>
        <button
          type="button"
          class="text-text-muted hover:text-accent"
          onclick={() => startCreate("", true)}
          title="New Folder"
          aria-label="New Folder"
          data-testid="new-folder-button"
        >📁</button>
      </div>
    {/if}
  </div>

  {#if creating && creating.parentDir === ""}
    <div class="flex items-center gap-1 px-3 py-1">
      <input
        class="w-full rounded border border-border-focus bg-surface px-1 py-0.5 text-xs text-text outline-none"
        bind:value={createValue}
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commitCreate();
          if (e.key === "Escape") creating = null;
        }}
        placeholder={creating.isDir ? "folder name" : "filename"}
        data-testid="create-input"
        autofocus
      />
    </div>
  {/if}

  {#each root as node (node.path)}
    {@render treeNode(node, 0)}
  {/each}
</div>

{#if contextMenu}
  <div
    class="fixed z-50 rounded border border-border bg-surface-overlay py-1 shadow-lg"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px"
    data-testid="context-menu"
    role="menu"
  >
    <button
      type="button"
      class="block w-full px-3 py-1 text-left text-xs text-text hover:bg-surface hover:text-accent"
      onclick={() => startCreate(contextMenu?.isDir ? contextMenu.path : contextMenu?.path.split("/").slice(0, -1).join("/") ?? "", false)}
      role="menuitem"
    >New File</button>
    <button
      type="button"
      class="block w-full px-3 py-1 text-left text-xs text-text hover:bg-surface hover:text-accent"
      onclick={() => startCreate(contextMenu?.isDir ? contextMenu.path : contextMenu?.path.split("/").slice(0, -1).join("/") ?? "", true)}
      role="menuitem"
    >New Folder</button>
    <hr class="my-1 border-border" />
    <button
      type="button"
      class="block w-full px-3 py-1 text-left text-xs text-text hover:bg-surface hover:text-accent"
      onclick={() => startRename(contextMenu!.path)}
      role="menuitem"
    >Rename</button>
    <button
      type="button"
      class="block w-full px-3 py-1 text-left text-xs text-error hover:bg-surface"
      onclick={() => requestDelete(contextMenu!.path, contextMenu!.isDir)}
      role="menuitem"
    >Delete</button>
  </div>
{/if}

{#if confirmDelete}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    data-testid="delete-confirm"
  >
    <div class="rounded border border-border bg-surface-overlay p-4 shadow-lg">
      <p class="text-sm text-text">
        Delete <code class="text-accent">{confirmDelete.path}</code>{confirmDelete.isDir ? " and all its contents" : ""}?
      </p>
      <div class="mt-3 flex justify-end gap-2">
        <button
          type="button"
          class="rounded border border-border px-3 py-1 text-xs text-text hover:border-accent"
          onclick={() => confirmDelete = null}
          data-testid="delete-cancel"
        >Cancel</button>
        <button
          type="button"
          class="rounded bg-error px-3 py-1 text-xs text-surface"
          onclick={executeDelete}
          data-testid="delete-confirm-button"
        >Delete</button>
      </div>
    </div>
  </div>
{/if}

{#snippet treeNode(node: TreeNode, depth: number)}
  <div
    id={`tree-item-${encodeURIComponent(node.path)}`}
    role="treeitem"
    aria-expanded={node.isDir ? !collapsed.has(node.path) : undefined}
    aria-selected={node.path === selectedPath}
    data-testid={node.isDir ? "tree-dir" : "tree-file"}
    data-path={node.path}
  >
    <button
      type="button"
      class="flex w-full items-center gap-1 py-1.5 text-left hover:text-accent md:py-1
             {node.path === selectedPath ? 'bg-surface-overlay text-text' : 'text-text-muted'}
             {node.path === focusedPath ? 'outline outline-1 outline-border-focus' : ''}"
      style="padding-left: {depth * 16 + 12}px"
      onclick={() => {
        focusedPath = node.path;
        if (node.isDir) toggleCollapse(node.path);
        else selectFile(node.path);
      }}
      oncontextmenu={(e) => showContextMenu(e, node.path, node.isDir)}
    >
      {#if node.isDir}
        <span class="w-3 text-[10px] text-text-muted">
          {collapsed.has(node.path) ? "▶" : "▼"}
        </span>
      {:else}
        <span class="w-3 text-[10px]">{fileIcon(node.name)}</span>
      {/if}

      {#if renaming === node.path}
        <input
          class="flex-1 rounded border border-border-focus bg-surface px-1 py-0 text-xs text-text outline-none"
          bind:value={renameValue}
          onkeydown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") renaming = null;
          }}
          onblur={commitRename}
          data-testid="rename-input"
          autofocus
        />
      {:else}
        <span class="truncate">{node.name}</span>
      {/if}
    </button>

    {#if node.isDir && !collapsed.has(node.path)}
      {#if creating && creating.parentDir === node.path}
        <div class="flex items-center gap-1 py-1" style="padding-left: {(depth + 1) * 16 + 12}px">
          <input
            class="w-full rounded border border-border-focus bg-surface px-1 py-0.5 text-xs text-text outline-none"
            bind:value={createValue}
            onkeydown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitCreate();
              if (e.key === "Escape") creating = null;
            }}
            placeholder={creating.isDir ? "folder name" : "filename"}
            data-testid="create-input"
            autofocus
          />
        </div>
      {/if}
      {#each node.children as child (child.path)}
        {@render treeNode(child, depth + 1)}
      {/each}
    {/if}
  </div>
{/snippet}
