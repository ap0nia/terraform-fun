import type { ProxyHandler } from 'aws-lambda'

/**
 * ESBuild will pick up on this and copy the env file to the output folder.
 */
try {
  require("../.env");
} catch {
  /* noop */
}

interface SubscriptionData {
  topic: string
  callback: string
  token: string
}

class PubSubHubbub {
  constructor(private readonly hub: string) { }

  async subscribe(data: SubscriptionData) {
    const body = new FormData()

    body.append('hub.mode', 'subscribe')
    body.append('hub.topic', data.topic)
    body.append('hub.callback', data.callback)

    const response = await fetch(this.hub, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.token}`,
      },
      body
    })

    return response
  }

  async unsubscribe(data: SubscriptionData) {
    const body = new FormData()

    body.append('hub.mode', 'unsubscribe')
    body.append('hub.topic', data.topic)
    body.append('hub.callback', data.callback)

    const response = await fetch(this.hub, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.token}`,
      },
      body
    })

    return response
  }
}


export const handler: ProxyHandler = async () => {
  const owner = 'ap0nia'
  const repo = 'terraform-fun'
  const authorization = ''

  const pubsub = new PubSubHubbub('https://api.github.com/hub')

  const data: SubscriptionData = {
    topic: `https://github.com/${owner}/${repo}/events/issues.json`,
    callback: 'https://9be6-104-7-144-91.ngrok.io',
    token: authorization
  }

  const response = await pubsub.subscribe(data)

  return {
    statusCode: 200,
    body: JSON.stringify(response)
  }
}

async function main() {
  console.log('Starting...')
}

main()
