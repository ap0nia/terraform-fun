import 'dotenv/config'

import crypto from 'node:crypto'
import { type } from 'arktype'
import { ProbotOctokit } from 'probot'
import type { ProxyHandler } from 'aws-lambda'

const owner = 'ap0nia'
const repo = 'terraform-fun'
const workflow_id = 'deploy.yml'
const ref = 'main'

global.crypto ??= crypto

/**
 * esbuild will pick up on this and copy the env file to the output folder.
 */
try {
  require("../.env");
} catch {
  /* noop */
}

const envSchema = type({
  APP_ID: 'string',
  PRIVATE_KEY: 'string',
  INSTALLATION_ID: 'string',
})

const env = envSchema.assert({ ...process.env })

export const handler: ProxyHandler = async () => {
  const probot = new ProbotOctokit({
    auth: {
      appId: env.APP_ID,
      privateKey: env.PRIVATE_KEY,
      installationId: env.INSTALLATION_ID,
    }
  })

  const response = await probot.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id,
    ref,
    inputs: { ref, },
  })

  return {
    statusCode: 200,
    body: JSON.stringify(response)
  }
}
