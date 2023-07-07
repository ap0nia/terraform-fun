import { octokit } from '$lib/server/services/octokit'
import type { PageServerLoad } from './$types'

type Deployment = Awaited<ReturnType<typeof octokit.rest.repos.listDeployments>>['data'][number]

type DeploymentStatus = Awaited<ReturnType<typeof octokit.rest.repos.listDeploymentStatuses>>['data'][number]

type Commit = Awaited<ReturnType<typeof octokit.rest.repos.getCommit>>['data']

interface EnhancedDeployment extends Deployment { 
  status: DeploymentStatus 
  commit: Commit
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = await locals.getUser()

  if (!user?.login) {
    return {
      deployments: [],
    }
  }

  const deploymentsResponse = await octokit.rest.repos.listDeployments({
    owner: user.login,
    repo: params.repo,
    per_page: 10,
  })

  const deployments = deploymentsResponse.data as EnhancedDeployment[]

  await Promise.all(
    deployments.map(async (deployment, index) => {
      const status = await octokit.rest.repos.listDeploymentStatuses({
        owner: user.login,
        repo: params.repo,
        deployment_id: deployment.id
      })
      deployments[index].status = status.data[0]
    })
  )

  await Promise.all(
    deployments.map(async (deployment, index) => {
      const commit = await octokit.rest.repos.getCommit({
        owner: user.login,
        repo: params.repo,
        ref: deployment.sha
      })
      deployments[index].commit = commit.data
    })
  )

  return {
    deployments,
  }
}
