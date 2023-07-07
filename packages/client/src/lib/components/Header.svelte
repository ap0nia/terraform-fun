<script lang="ts">
  import { page } from "$app/stores";

  $: user = $page.data.user;
  $: crumbs = $page.data.crumbs?.reduce((currentCrumbs, crumb) => {
    const previousPaths = currentCrumbs.map(([, path]) => path)
    currentCrumbs.push([crumb, [...previousPaths, crumb].join('/')])
    return currentCrumbs
  }, [] as [string, string][]);
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
            <div class="i-mdi:slash-forward"></div>
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
          class="bg-red-200 px-4 py-2 rounded-full"
        >
          <button type="submit">Logout</button>
        </form>
      </div>
    {:else}
      <a href="/auth/login/github" class="bg-blue-200 p-4 py-2 rounded-full">
        Login with GitHub
      </a>
    {/if}
  </div>
</header>
