import 'dotenv/config'

import { ProbotOctokit } from 'probot'
import { type } from 'arktype'

const owner = 'ap0nia'
const repo = 'terraform-fun'
const workflow_id = 'deploy.yml'
const ref = 'main'

const envSchema = type({
  APP_ID: 'string',
  PRIVATE_KEY: 'string',
  INSTALLATION_ID: 'string',
})

const env = envSchema.assert({ ...process.env })

async function run() {
  const probot = new ProbotOctokit({
    auth: {
      appId: env.APP_ID,
      privateKey: env.PRIVATE_KEY,
      installationId: env.INSTALLATION_ID,
    }
  })

  await probot.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id,
    ref,
    inputs: { ref, },
  })
}

run()
