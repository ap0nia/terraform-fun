<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div>
  <h1>Workflows</h1>
  <div class="flex flex-col gap-2">
    {#each data.workflows?.workflows ?? [] as workflow}
      <div class="bg-secondary p-2">
        <name>{workflow.name}</name>

        <pre>
          {JSON.stringify(workflow, null, 2)}
        </pre>

        <form method="POST" class="bg-pink-300 p-2 rounded">
          <h3 class="text-center text-xl font-bold">Dispatch this workflow</h3>

          <label>
            <input type="hidden" name="workflow_id" value={workflow.id} />
          </label>

          <label class="p-1">
            <span>Branch or Tag</span>
            <input type="text" name="ref" class="w-full border-2 border-red-500 rounded p-2" value="main" />
          </label>

          <button class="p-2 rounded bg-yellow-200 my-2">
            Create Workflow Dispatch
          </button>
        </form>
      </div>
    {/each}
  </div>
</div>
