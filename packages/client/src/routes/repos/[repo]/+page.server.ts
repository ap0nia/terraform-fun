import { octokit } from '$lib/server/services/octokit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = await locals.getUser()

  if (!user?.login) {
    return {
      deployments: []
    }
  }

  const deployments = await octokit.rest.repos.listDeployments({
    owner: user.login,
    repo: params.repo
  })

  return {
    deployments: deployments.data
  }
}
