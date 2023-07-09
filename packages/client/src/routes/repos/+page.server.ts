import { octokit } from '$lib/server/services/octokit'
import { graphql } from '@octokit/graphql'
import type { PageServerLoad } from './$types'

const repoGql = `
query {
  viewer {
    repositories (first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
      nodes {
        id
        name
        url
        homepageUrl
        licenseInfo {
          name
        }
      }
    }
  }
}
`

export const load: PageServerLoad = async ({ locals }) => {
  const user = await locals.getUser()

  if (!user?.login) {
    return {
      repos: []
    }
  }

  const octokitGraphql = graphql.defaults({
    headers: {
      authorization: `token ${user.accessToken}`
    }
  })

  const repos = await octokitGraphql(repoGql)

  // const repos = await octokit.rest.repos.listForUser({
  //   username: user.login,
  // })

  return {
    repos: repos.viewer.repositories.nodes,
    // repos: repos.data
  }
}
