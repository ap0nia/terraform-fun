<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div class="flex flex-col gap-8 p-4">
  {#if data.repos}
    <div>
      <div class="my-2">
        <h1
          class="text-center font-extrabold text-4xl text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500"
        >
          Your repositories
        </h1>
      </div>

      <div class="grid xs:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each data.repos as repo}
          <div
            class="p-4 rounded relative hover:cursor-pointer hover:border bg-gradient-to-br from-pink-300 via-purple-300 to-indigo-300"
          >
            <p class="font-bold text-xl" style="grid-area: 1/1">
              {repo.name}
            </p>

            <a href="/repos/{repo.name}" class="absolute w-full h-full">
              &nbsp;
            </a>

            <div>
              <p>URL: {repo.url}</p>
              <p>LICENSE: {repo.licenseInfo?.name}</p>
              <p>HOMEPAGE: {repo.homepageUrl}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
