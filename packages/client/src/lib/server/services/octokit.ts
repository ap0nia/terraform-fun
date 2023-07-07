import { Octokit } from 'octokit'
import { createOAuthAppAuth } from '@octokit/auth-oauth-app'
import { CLIENT_ID, CLIENT_SECRET } from '$env/static/private'

export const octokit = new Octokit({
  authStrategy: createOAuthAppAuth,
  auth: {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  },
})
