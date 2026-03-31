<script lang="ts">
  import {
    getSession,
    setSession,
    clearSession,
    requestLogin,
    verifyToken,
    getMe,
    logout as doLogout,
  } from "$frontiers/auth-client.js";

  let {
    apiBase,
    onauth,
  }: {
    apiBase: string | null;
    onauth: (email: string | null) => void;
  } = $props();

  let email = $state<string | null>(null);
  let showLogin = $state(false);
  let loginEmail = $state("");
  let loginStatus = $state<"idle" | "sending" | "sent" | "error">("idle");
  let loginMessage = $state("");

  // Check for session on mount and for verify token in URL
  $effect(() => {
    if (!apiBase) return;
    // Check for ?session= param (magic link redirect)
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get("session");
    if (tokenParam) {
      setSession(tokenParam);
      history.replaceState(null, "", location.pathname);
    }
    // Check for ?token= param (direct verify)
    const verifyParam = params.get("token");
    if (verifyParam) {
      verifyToken(apiBase, verifyParam).then((result) => {
        if (result) {
          setSession(result.sessionToken);
          email = result.email;
          onauth(result.email);
          history.replaceState(null, "", location.pathname);
        }
      });
      return;
    }
    // Check existing session
    getMe(apiBase).then((user) => {
      if (user) {
        email = user.email;
        onauth(user.email);
      }
    });
  });

  async function handleLogin() {
    if (!apiBase || !loginEmail.trim()) return;
    loginStatus = "sending";
    const result = await requestLogin(apiBase, loginEmail.trim());
    if (result.ok) {
      loginStatus = "sent";
      loginMessage = result.message;
    } else {
      loginStatus = "error";
      loginMessage = result.message;
    }
  }

  async function handleLogout() {
    if (apiBase) await doLogout(apiBase);
    email = null;
    onauth(null);
  }
</script>

{#if !apiBase}
  <!-- No API configured, auth unavailable -->
{:else if email}
  <div class="flex items-center gap-2">
    <span class="text-[10px] text-text-muted">{email}</span>
    <button class="text-[10px] text-text-muted hover:text-text" onclick={handleLogout}>logout</button>
  </div>
{:else}
  <button
    class="rounded border border-border px-2 py-1 text-xs text-text-muted hover:border-accent hover:text-accent"
    onclick={() => (showLogin = !showLogin)}
  >
    Sign in
  </button>

  {#if showLogin}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onclick={() => (showLogin = false)}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="w-80 rounded-lg border border-border bg-surface-raised p-4 shadow-xl" onclick={(e) => e.stopPropagation()}>
        <h3 class="mb-3 text-sm font-medium text-text">Sign in to BlazeTrails Frontiers</h3>
        <p class="mb-3 text-xs text-text-muted">Enter your email and we'll send you a magic link.</p>

        {#if loginStatus === "sent"}
          <div class="rounded border border-success/30 bg-success/10 p-3">
            <p class="text-xs text-success">{loginMessage}</p>
          </div>
        {:else}
          <div class="space-y-2">
            <input
              bind:value={loginEmail}
              onkeydown={(e) => { if (e.key === "Enter") handleLogin(); }}
              type="email"
              class="w-full rounded border border-border bg-surface-overlay px-3 py-2 text-xs text-text outline-none focus:border-border-focus"
              placeholder="you@example.com"
            />
            {#if loginStatus === "error"}
              <p class="text-xs text-error">{loginMessage}</p>
            {/if}
            <button
              class="w-full rounded bg-accent py-2 text-xs font-medium text-surface hover:bg-accent-hover disabled:opacity-50"
              onclick={handleLogin}
              disabled={loginStatus === "sending" || !loginEmail.trim()}
            >
              {loginStatus === "sending" ? "Sending..." : "Send magic link"}
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
{/if}
