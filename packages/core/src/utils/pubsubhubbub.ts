export interface SubscriptionData {
  topic: string
  callback: string
  token: string
}

export class PubSubHubbub {
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


