<script lang="ts">
  import { page } from "$app/stores";

  $: user = $page.data.user;

  $: crumbs = $page.url.pathname
    .split("/")
    .filter(Boolean)
    .map((crumb, i, arr) => {
      const href = arr.slice(0, i + 1).join("/");
      return [crumb, href];
    });
</script>

<header class="flex top-0 z-40 w-full border-b p-4 items-center">
  <div class="flex">
    <div class="hidden md:flex items-center gap-4">
      <a href="/" class="i-vercel:logo text-4xl">&nbsp;</a>
      {#if user}
        <div class="flex p-1">
          <img
            src={user.avatar_url}
            alt="Github Avatar"
            width="36"
            height="36"
            class="rounded-full border"
          />
        </div>
      {/if}

      <div class="flex items-center">
        {#if crumbs}
          {#each crumbs as [crumb, href]}
            <div class="i-mdi:slash-forward" />
            <div class="flex items-center">
              <a href="/{href}">{crumb}</a>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <div class="flex-grow-1" />

  <div>
    {#if user}
      <div class="flex">
        <form
          action="/auth/logout"
          method="POST"
          class="bg-red-500 px-4 py-2 rounded-full text-white flex items-center gap-2"
        >
          <div class="i-mdi:logout" />
          <button type="submit">Logout</button>
        </form>
      </div>
    {/if}
  </div>
</header>
