<script lang="ts">
  interface Props {
    tutorial: string;
    currentStep: number;
    totalSteps: number;
    onnavigate: (step: number) => void;
  }

  let { tutorial, currentStep, totalSteps, onnavigate }: Props = $props();
</script>

<nav
  class="flex items-center justify-between border-b border-border bg-surface-raised px-4 py-2"
  aria-label="Tutorial navigation"
  data-testid="step-nav"
>
  <div class="flex items-center gap-2 text-xs">
    <span class="text-text-muted">Learn</span>
    <span class="text-text-muted">/</span>
    <span class="text-accent">{tutorial}</span>
    <span class="text-text-muted">/</span>
    <span class="text-text">Step {currentStep}</span>
  </div>

  <div class="flex items-center gap-1" role="group" aria-label="Step indicators">
    {#each Array(totalSteps) as _, i}
      <button
        onclick={() => onnavigate(i + 1)}
        class="h-2 w-2 rounded-full transition-colors
               {i + 1 === currentStep ? 'bg-accent' : 'bg-border hover:bg-text-muted'}"
        aria-label="Step {i + 1}"
        aria-current={i + 1 === currentStep ? "step" : undefined}
        data-testid="step-dot"
      ></button>
    {/each}
  </div>

  <div class="flex gap-2">
    <button
      onclick={() => onnavigate(currentStep - 1)}
      disabled={currentStep <= 1}
      class="rounded border border-border px-2 py-1 text-xs text-text
             hover:border-accent hover:text-accent
             disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text"
      data-testid="prev-button"
    >
      Prev
    </button>
    <button
      onclick={() => onnavigate(currentStep + 1)}
      disabled={currentStep >= totalSteps}
      class="rounded border border-border px-2 py-1 text-xs text-text
             hover:border-accent hover:text-accent
             disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text"
      data-testid="next-button"
    >
      Next
    </button>
  </div>
</nav>
