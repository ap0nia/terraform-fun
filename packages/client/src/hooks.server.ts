import { AponiaAuth } from 'aponia'
import { AponiaSession } from 'aponia/session'
import { GitHub } from 'aponia/providers/github'
import { sequence } from '@sveltejs/kit/hooks'
import { createAuthHelpers } from '@aponia/sveltekit'
import { CLIENT_ID, CLIENT_SECRET } from '$env/static/private'
import { error, type Handle } from '@sveltejs/kit'

const session = AponiaSession({
  secret: 'secret',
  createSession(user) {
    return { user, accessToken: user }
  },
  onInvalidateAccessToken(_accessToken, _refreshToken) {
    return { redirect: '/', status: 302 }
  },
})

const github = GitHub({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  endpoints: {
    authorization: {
      url: "https://github.com/login/oauth/authorize",
      params: { scope: "repo workflow" },
    },
  },
  onAuth(user, tokens) {
    return {
      user: { ...user, accessToken: tokens.access_token },
      redirect: '/dashboard',
      status: 302
    }
  },
})

const auth = AponiaAuth({
  session,
  providers: [github],
})

const authorizationHandle: Handle = async ({ event, resolve }) => {
  if (
    event.url.pathname.startsWith('/dashboard') ||
    event.url.pathname.startsWith('/repos')
  ) {
    const user = await event.locals.getUser()
    if (!user) {
      throw error(401, 'Unauthorized')
    }
  }

  return resolve(event)
}

const authenticationHandle = createAuthHelpers(auth)

export const handle = sequence(authenticationHandle, authorizationHandle)
