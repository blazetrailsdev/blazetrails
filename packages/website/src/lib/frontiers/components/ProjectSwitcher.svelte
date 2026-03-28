<script lang="ts">
  import type { ProjectMeta } from "$frontiers/project-store.js";
  import { ProjectStore } from "$frontiers/project-store.js";
  import { templates, type Template } from "$frontiers/templates.js";
  import ConfirmDialog from "./ConfirmDialog.svelte";

  let {
    currentProject = $bindable(""),
    projects,
    sharing,
    ontrailnew,
    onopen,
    onsave,
    onsaveas,
    ondelete,
    onpublish,
    onimport,
    onexport,
  }: {
    currentProject: string;
    projects: ProjectMeta[];
    sharing: boolean;
    ontrailnew: (name: string, template?: Template) => void;
    onopen: (name: string) => void;
    onsave: () => void;
    onsaveas: (name: string) => void;
    ondelete: (name: string) => void;
    onpublish: () => void;
    onimport?: (data: Uint8Array, name: string) => void;
    onexport?: () => void;
  } = $props();

  let show = $state(false);
  let showNew = $state(false);
  let newName = $state("");
  let selectedTemplate = $state(0);
  let confirmDelete = $state("");
  let fileInput: HTMLInputElement | undefined = $state();

  function handleCreate() {
    if (!newName.trim()) return;
    ontrailnew(newName.trim(), templates[selectedTemplate]);
    newName = "";
    showNew = false;
    show = false;
    selectedTemplate = 0;
  }

  function handleSaveAs() {
    if (!newName.trim()) return;
    onsaveas(newName.trim());
    newName = "";
    showNew = false;
    show = false;
  }

  async function handleFileImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const data = await ProjectStore.readFile(file);
    const name = file.name.replace(/\.sqlite$/, "");
    onimport?.(data, name);
    show = false;
  }
</script>

<div class="relative">
  <button
    class="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-text hover:border-accent"
    onclick={() => (show = !show)}
  >
    <span class="max-w-32 truncate">{currentProject || "untitled"}</span>
    <span class="text-[10px] text-text-muted">&#x25BC;</span>
  </button>

  {#if show}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute left-0 top-full z-50 mt-1 w-72 rounded border border-border bg-surface-raised shadow-lg"
      onkeydown={(e) => { if (e.key === "Escape") show = false; }}
    >
      <div class="border-b border-border p-2">
        {#if showNew}
          <div class="space-y-2">
            <div class="flex gap-1">
              <input
                bind:value={newName}
                onkeydown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") showNew = false; }}
                class="flex-1 rounded border border-border-focus bg-surface-overlay px-2 py-1 text-xs text-text outline-none"
                placeholder="project-name"
                spellcheck="false"
              />
              <button class="rounded bg-accent px-2 py-1 text-xs text-surface hover:bg-accent-hover" onclick={handleCreate}>Create</button>
            </div>
            <div class="flex flex-wrap gap-1">
              {#each templates as tmpl, i}
                <button
                  class="rounded px-2 py-0.5 text-[10px] {selectedTemplate === i ? 'bg-accent/20 text-accent' : 'bg-surface-overlay text-text-muted hover:text-text'}"
                  onclick={() => (selectedTemplate = i)}
                  title={tmpl.description}
                >{tmpl.name}</button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="flex gap-1">
            <button class="flex-1 rounded border border-border px-2 py-1 text-xs text-text hover:border-accent hover:text-accent" onclick={() => (showNew = true)}>trail new</button>
            <button class="rounded border border-border px-2 py-1 text-xs text-text hover:border-accent hover:text-accent" onclick={() => { onsave(); show = false; }}>Save</button>
            <button class="rounded border border-border px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-50" onclick={() => { onpublish(); show = false; }} disabled={sharing}>Publish</button>
          </div>
          <div class="mt-1.5 flex gap-1">
            <button class="flex-1 rounded border border-border px-2 py-0.5 text-[10px] text-text-muted hover:text-text" onclick={() => fileInput?.click()}>Import .sqlite</button>
            <button class="flex-1 rounded border border-border px-2 py-0.5 text-[10px] text-text-muted hover:text-text" onclick={() => { onexport?.(); show = false; }}>Export .sqlite</button>
          </div>
          <input bind:this={fileInput} type="file" accept=".sqlite,.db" class="hidden" onchange={handleFileImport} />
        {/if}
      </div>
      <div class="max-h-48 overflow-auto">
        {#if projects.length === 0}
          <div class="p-3 text-center text-xs text-text-muted">No saved projects</div>
        {:else}
          {#each projects as project}
            <div class="group flex items-center border-b border-border/50 last:border-0">
              <button
                class="flex flex-1 items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-overlay {project.name === currentProject ? 'text-accent' : 'text-text'}"
                onclick={() => { onopen(project.name); show = false; }}
              >
                <span class="flex-1 truncate">{project.name}</span>
                <span class="text-[10px] text-text-muted">{(project.size / 1024).toFixed(0)}KB</span>
              </button>
              <button
                class="hidden px-2 text-[10px] text-text-muted hover:text-error group-hover:block"
                onclick={() => (confirmDelete = project.name)}
              >x</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if confirmDelete}
  <ConfirmDialog
    message={`Delete project "${confirmDelete}"? This cannot be undone.`}
    onconfirm={() => { ondelete(confirmDelete); confirmDelete = ""; }}
    oncancel={() => (confirmDelete = "")}
  />
{/if}
