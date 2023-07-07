<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div class="flex flex-col gap-4">
  <h1
    class="text-center font-extrabold text-transparent text-7xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600"
  >
    Vercel at Home
  </h1>

  <div class="w-full flex justify-center gap-3">
    {#if data.user}
      <a
        href="/repos"
        class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        Repositories
      </a>
    {:else}
      <a
        href="/auth/login/github"
        class="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >Login
      </a>
    {/if}
  </div>
</div>
