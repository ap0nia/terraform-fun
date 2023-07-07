import { octokit } from '$lib/server/services/octokit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
  const user = await locals.getUser()

  if (!user?.login) {
    return {
      repos: []
    }
  }

  const repos = await octokit.rest.repos.listForUser({ 
    username: user.login,
    type: 'all',
  })

  return {
    repos: repos.data
  }
}
