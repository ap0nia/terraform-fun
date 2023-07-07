<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div class="flex flex-col gap-8 p-4">
  {#if data.repos}
    <div>
      <h1 class="text-xl underline text-pink-500 text-center font-bold">
        Your repositories
      </h1>
      <div class="grid xs:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each data.repos as repo}
          <div
            class="bg-blue-300 rounded grid rounded hover:cursor-pointer hover:border border-pink-300"
          >
            <div class="p-4 hover:bg-red-400" style="grid-area: 1/1">
              {repo.name}
            </div>
            <a
              href="/repos/{repo.name}"
              class="row-start-1 row-end-2 col-start-1 col-end-2"
              style="grid-area: 1/1"
            >
              &nbsp;
            </a>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
