<script>
  import { onMount } from "svelte";
  // Redirect to the TypeDoc generated docs
  onMount(() => {
    window.location.href = "/docs/index.html";
  });
</script>

<div class="flex min-h-screen items-center justify-center" style="font-family: var(--font-sans);">
  <p class="text-text-muted">Loading API docs...</p>
</div>
