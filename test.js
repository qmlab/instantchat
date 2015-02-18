var https = require('https')

data = {
  username: 'Mian Qin',
  auth: {
    accessToken: "CAAE7pJZBgeagBAFPJsZCBIwSesXZCcNBLRCCqZBvJZAisFy2wbFIX1wnyE57aBu3LEad6ksX44Ko1qGK9wHCkDGTwLNZCgvZBNvwxy3IHj9BgeZCpNOBcnW3IBNyz9F8WUM8kolQeKFI4Xmua9nJvAZALLCIOk3bh05DKZARKfeuXAnHbU2mUELIbt8j8KZBy2esbIovovZCQ3QPW9FfT4bfuzdqZCewZCr9hflAEZD",
    expiresIn: 3613,
    signedRequest: "sJtG310NOs1JoLflAD90tcU30ElFnIEBk8IEqD4J5F4.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImNvZGUiOiJBUURNeWlQSWZEYm9wc3JVYXNQdUZMbVdBalZKWkg2WmE1OFpuNEJQeWNDaFpjcjB4UEFhWVl1b05aUm1nTURCTldicElSQi0tLXJDSTBQQ3I4dXlfVlVmRTZmWWNwamFQbWhwSVdUc3ZYc2t5N0ZRZTE2UnhXNEYyYUpCTXlDS1V0M2NFeWV0SnZUNWFXdXI5RVZ6dVYya2FqQm9DanhjNzZ6MGJvUXRiSWNDODJYNnE2Vk5qOUZ4ODBQVTdqMnI1VTlmVXJhSUlVZWI1aWV4b3kxdmtKRTNIWnYxZmV3amZ3djZHWmp6eXYyNG1ZS2JhSWJkaFIxaHV6Tm43SnRKbkxZWkZVOU9OaS1zQ2c1QjRncThRVzJMYlcwRkZlbWlOVkYtMjk4VW5aNTlwSnFEMmVZSFZqM0JsWHpLd0YyaTNpdW5lNWQ5UTRyWk1FTGtuMkJKMHRDMERwTlVRUldjX0VKOUxWamxGampoSXciLCJpc3N1ZWRfYXQiOjE0MjQyMjgzODcsInVzZXJfaWQiOiIxMDE1MjU3OTkzMDk0MTQzMyJ9",
    type: "facebook",
    userID: "10152579930941433"
  }
}

console.log('verifying facebook')
var options = {
  hostname: 'graph.facebook.com',
  port: 443,
  path: '/me?accesstoken=' + data.auth.accessToken,
  method: 'GET'
}

var url = 'https://graph.facebook.com/me?access_token=' + data.auth.accessToken

console.log(url)

var req = https.request(options, function(res) {
  console.log("statusCode: ", res.statusCode);
  console.log("headers: ", res.headers);
  res.on('data', function(resultStr) {
    var result = JSON.parse(resultStr)
    if (result.verified && result.name === data.username) {
      console.log('server-side access token verification passed')
    }
    else {
      console.log('server-side access token verification failed')
    }
  })

})

req.end()

req.on('error', function(e) {
  console.log('failed to verify facebook access token')
  console.error(e)
})
