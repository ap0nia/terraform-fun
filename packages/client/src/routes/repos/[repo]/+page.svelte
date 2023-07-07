<script lang="ts">
  import type { PageData } from "./$types";

  export let data: PageData;
</script>

<div class="p-2 w-full flex justify-center">
  <a href="/repos/{data.repo}/deployments" class="p-2 bg-blue-200 rounded">Go to deployments</a>
</div>
