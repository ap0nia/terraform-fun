import core from '@actions/core'
import github from '@actions/github'

async function run() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? core.getInput('GITHUB_TOKEN');
  const octokit = github.getOctokit(GITHUB_TOKEN)

  const owner = github.context.repo.owner
  const repo = github.context.repo.repo
  const ref = github.context.ref

  const deployment = await octokit.rest.repos.createDeployment({
    owner,
    repo,
    ref,
    required_contexts: [],
  })

  if (deployment.status !== 201) {
    throw new Error('Deployment failed')
  }

  await octokit.rest.repos.createDeploymentStatus({
    repo: github.context.repo.repo,
    owner: github.context.repo.owner,
    deployment_id: deployment.data.id,
    state: 'success',
    description: 'Deployment succeeded',
    environment_url: 'https://trpc-svelte-toolbox-dadngwhpd-bevm0.vercel.app',
    auto_inactive: false,
  })
}

run()
