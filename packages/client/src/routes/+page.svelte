<script lang="ts">
  import { page } from '$app/stores'

  $: user = $page.data.user
</script>

<div class="flex flex-col gap-8 p-4">
  {#if user}
    <div>
      <h1>You're logged in as {user.name}</h1>
    </div>
  {:else}
    <div>
      <h1>Please login!</h1>
    </div>
  {/if}
</div>
