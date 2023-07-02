import type { ProxyHandler } from 'aws-lambda'
import { PubSubHubbub, type SubscriptionData } from '../utils/pubsubhubbub.js';

/**
 * ESBuild will pick up on this and copy the env file to the output folder.
 */
try {
  require("../../.env");
} catch {
  /* noop */
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
