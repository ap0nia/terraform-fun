const express = require('express')
const expressPlayground = require('graphql-playground-middleware-express')
  .default

const app = express()

app.get('/playground', expressPlayground({ endpoint: '/graphql' }))

app.listen(6969, () => {
  console.log('Server started at http://localhost:6969/playground')
})

export const gqp = `
query {
  user(login: "ap0nia") {
    repositories (
      first: 5, 
      orderBy: { direction: DESC, field: UPDATED_AT }
    ) {
      nodes {
        id
        deployments (first: 1) {
          nodes {
            statuses (first: 1) {
              nodes {
                environmentUrl
              }
            }
            commit {
              message
            }
          }
        }
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
