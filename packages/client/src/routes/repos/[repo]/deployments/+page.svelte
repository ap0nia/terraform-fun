<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div>
  <h1>Deployments</h1>
  <div class="flex flex-col gap-2">
    {#each data.deployments as deployment}
      <div class="bg-secondary p-2">
        <pre>
          {JSON.stringify(deployment, null, 2)}
        </pre>
      </div>
    {/each}
  </div>
</div>
