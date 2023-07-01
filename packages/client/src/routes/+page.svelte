<script lang="ts">
  let data: any

  async function handleClick() {
    const response = await fetch('https://3z5i1laxlc.execute-api.us-east-1.amazonaws.com/')
    data = await response.json()
  }
</script>

<button type="button" on:click={handleClick}>Trigger a workflow!</button>

<h1>Response Data...</h1>

<pre>{JSON.stringify(data, null, 2)}</pre>
