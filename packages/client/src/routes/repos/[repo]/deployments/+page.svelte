<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div>
  <div>
    <h1
      class="text-center font-extrabold text-transparent text-4xl bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 p-4"
    >
      Deployments
    </h1>
  </div>
  <div class="flex flex-col gap-2">
    {#each data.deployments ?? [] as deployment}
      <div class="bg-blue-200 p-2">
        <p>{deployment.sha}</p>
        <p>{deployment.status.environment_url}</p>
        <p>{deployment.environment}</p>
        <p>{deployment.status.state}</p>
        <p>{deployment.description}</p>
        <p>{deployment.id}</p>
        <p>{deployment.ref.replace('refs/heads/', '')}</p>
        <p>{deployment.commit.commit.message}</p>
      </div>
    {/each}
  </div>
</div>
