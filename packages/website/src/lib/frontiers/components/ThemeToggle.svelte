<script lang="ts">
  import { onMount } from "svelte";

  let theme = $state<"dark" | "light">("dark");

  onMount(() => {
    theme = (localStorage.getItem("frontiers:theme") as "dark" | "light") ?? "dark";
    apply(theme);
  });

  function apply(t: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("frontiers:theme", t);
  }

  function toggle() {
    theme = theme === "dark" ? "light" : "dark";
    apply(theme);
  }

  export function getTheme() {
    return theme;
  }
</script>

<button
  class="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text"
  onclick={toggle}
  title="Toggle theme"
>
  {theme === "dark" ? "light" : "dark"}
</button>
