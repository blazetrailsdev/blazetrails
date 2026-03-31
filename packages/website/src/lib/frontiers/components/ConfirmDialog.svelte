<script lang="ts">
  let {
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = true,
    onconfirm,
    oncancel,
  }: {
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") oncancel();
    if (e.key === "Enter") onconfirm();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
  onclick={oncancel}
  onkeydown={handleKeydown}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="w-80 rounded-lg border border-border bg-surface-raised p-4 shadow-xl"
    onclick={(e) => e.stopPropagation()}
  >
    <p class="mb-4 text-sm text-text">{message}</p>
    <div class="flex justify-end gap-2">
      <button
        class="rounded border border-border px-3 py-1 text-xs text-text-muted hover:text-text"
        onclick={oncancel}
      >
        {cancelLabel}
      </button>
      <button
        class="rounded px-3 py-1 text-xs font-medium text-surface {destructive ? 'bg-error hover:bg-error/80' : 'bg-accent hover:bg-accent-hover'}"
        onclick={onconfirm}
      >
        {confirmLabel}
      </button>
    </div>
  </div>
</div>
