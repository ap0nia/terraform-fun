import type { GitHubProfile } from 'aponia/providers/github'

declare global {
  namespace Aponia {
    interface User extends GitHubProfile { }
  }

  namespace App {
    interface Locals {
      /**
       * Helper function to get the user for the current request.
       */
      getUser: () => Promise<Aponia.User | null>
    }

    interface PageData {
      /**
       * Whether the user has accepted the cookie policy.
       */
      accepted_cookies?: boolean

      /**
       * User parsed from session / cookies. `isAdmin` is added to the user.
       */
      user?: Aponia.User
    }
  }
}


export { }
