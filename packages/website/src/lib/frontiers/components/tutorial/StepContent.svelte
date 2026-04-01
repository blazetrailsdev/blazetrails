<script lang="ts">
  import type { TutorialStep, FileDiff } from "../../tutorials/types.js";
  import type { CliResult } from "../../trail-cli.js";
  import type { VirtualFS } from "../../virtual-fs.js";
  import type { SqlJsAdapter } from "../../sql-js-adapter.js";
  import ActionCard from "./ActionCard.svelte";
  import CheckpointPanel from "./CheckpointPanel.svelte";

  interface Props {
    step: TutorialStep;
    exec: (command: string) => Promise<CliResult>;
    vfs: VirtualFS;
    adapter: SqlJsAdapter;
    onfileclick?: (path: string) => void;
    onchange?: () => void;
  }

  let { step, exec, vfs, adapter, onfileclick, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-4 p-4" data-testid="step-content">
  <h2 class="text-lg font-bold text-accent">{step.title}</h2>

  {#each step.description as paragraph}
    <p class="text-sm leading-relaxed text-text">{paragraph}</p>
  {/each}

  {#if step.actions.length > 0}
    <div class="flex flex-col gap-3">
      {#each step.actions as action}
        <ActionCard {action} {exec} {vfs} {onfileclick} {onchange} />
      {/each}
    </div>
  {/if}

  {#if step.checkpoint.length > 0}
    <CheckpointPanel checks={step.checkpoint} {vfs} {adapter} />
  {/if}
</div>
