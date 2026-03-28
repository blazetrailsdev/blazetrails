<script lang="ts">
  export type LogEntry = {
    type: "info" | "error" | "success" | "warn" | "log";
    text: string;
    timestamp: number;
  };

  let {
    lines = $bindable([]),
  }: {
    lines: LogEntry[];
  } = $props();

  let el: HTMLDivElement | undefined = $state();
  type Tab = "console" | "logs";
  let tab: Tab = $state("console");

  export function log(type: LogEntry["type"], text: string) {
    lines = [...lines, { type, text, timestamp: Date.now() }];
    requestAnimationFrame(() => el?.scrollTo(0, el.scrollHeight));
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function logColor(type: LogEntry["type"]) {
    switch (type) {
      case "error": return "text-error";
      case "success": return "text-success";
      case "warn": return "text-warning";
      case "log": return "text-text";
      default: return "text-text-muted";
    }
  }

  $effect(() => {
    // Auto-scroll on new lines
    if (lines.length > 0) {
      requestAnimationFrame(() => el?.scrollTo(0, el.scrollHeight));
    }
  });

  const userLogCount = $derived(lines.filter((l) => l.type === "log" || l.type === "warn").length);
</script>

<div class="flex h-full flex-col">
  <div class="flex items-center bg-surface-raised">
    <button class="px-3 py-1 text-xs {tab === 'console' ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text'}" onclick={() => (tab = "console")}>Console</button>
    <button class="px-3 py-1 text-xs {tab === 'logs' ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text'}" onclick={() => (tab = "logs")}>
      Logs
      {#if userLogCount > 0}
        <span class="ml-1 rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">{userLogCount}</span>
      {/if}
    </button>
    <button class="ml-auto px-2 py-1 text-[10px] text-text-muted hover:text-text" onclick={() => (lines = [])}>Clear</button>
  </div>
  <div bind:this={el} class="flex-1 overflow-auto p-2">
    <div class="space-y-0.5 text-xs">
      {#each lines.filter((l) => (tab === "logs" ? l.type === "log" || l.type === "warn" : true)) as line}
        <div class="flex items-start gap-2 {logColor(line.type)}">
          <span class="shrink-0 text-[10px] text-text-muted">{formatTime(line.timestamp)}</span>
          <pre class="whitespace-pre-wrap">{line.text}</pre>
        </div>
      {/each}
    </div>
  </div>
</div>
