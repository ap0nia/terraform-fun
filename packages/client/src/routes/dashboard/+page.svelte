<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div class="flex flex-col gap-3 p-3 items-center">
  <h1>You're logged in as {data.user?.name}</h1>
  <div class="flex">
    <a
      href="/repos"
      class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
    >
      See your Repositories
    </a>
  </div>
</div>
