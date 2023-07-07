<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div class="p-2 flex flex-col gap-4 items-center">
  <div>
    <h1 class="font-extrabold text-4xl text-center text-transparent bg-clip-text bg-gradient-to-tr from-violet-400 via-blue-700 to-emerald-400">
      {data.repo}
    </h1>
  </div>
  <div>
    <a href="/repos/{data.repo}/deployments" class="p-2 bg-blue-200 rounded">
      Go to deployments
    </a>
    <a href="/repos/{data.repo}/workflows" class="p-2 bg-pink-200 rounded">
      Go to workflows
    </a>
  </div>
</div>
