import 'dotenv/config'

import type { ProxyHandler } from 'aws-lambda'

/**
 * esbuild will pick up on this and copy the env file to the output folder.
 */
try {
  require("../.env");
} catch {
  /* noop */
}

export const handler: ProxyHandler = async () => {
  const owner = 'ap0nia'
  const repo = 'terraform-fun'
  const authorization = ''

  const body = new FormData()
  body.append('hub.mode', 'subscribe')
  body.append('hub.topic', `https://github.com/${owner}/${repo}/events/issues.json`)
  body.append('hub.callback', 'https://9be6-104-7-144-91.ngrok.io')

  const response = await fetch('https://api.github.com/hub', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authorization}`,
    },
    body
  })

  return {
    statusCode: 200,
    body: JSON.stringify(response)
  }
}

async function main() {
  console.log('Starting...')
}

main()
