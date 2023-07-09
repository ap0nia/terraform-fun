import { Octokit } from 'octokit'
import { octokit } from '$lib/server/services/octokit'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = await locals.getUser()

  if (!user?.login) {
    return {
      workflows: {
        workflows: [],
      }
    }
  }

  const workflows = await octokit.rest.actions.listRepoWorkflows({
    owner: user.login,
    repo: params.repo
  })

  return {
    workflows: workflows.data,
  }
}

export const actions: Actions = {
  default: async (event) => {
    const user = await event.locals.getUser()

    if (!user?.login) {
      return
    }

    const formData = await event.request.formData()

    const ref = formData.get('ref')

    const workflow_id = formData.get('workflow_id')

    if (!(typeof ref === 'string' && typeof workflow_id === 'string')) {
      return
    }

    /**
     * User-specific Octokit instance.
     */
    const octokit = new Octokit({ auth: user.accessToken })

    octokit.rest.actions.enableWorkflow

    await octokit.rest.actions.createWorkflowDispatch({
      owner: user.login,
      repo: event.params.repo,
      ref,
      inputs: {
        ref,
      },
      workflow_id,
      headers: {
        authorization: `Bearer ${user.accessToken}`
      }
    })
  }
}
