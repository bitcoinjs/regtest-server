const debug = require('debug')
const debugWare = require('debug-ware')
const cors = require('cors')

require('easy-express-api')({
  middleware: [
    cors(),
    debugWare(debug('bjrt'))
  ],
  routes: {
    '/1': require('./routes/1')
  },
  services: [
    require('./service')
  ]
}, (err, server) => {
  if (err) throw err
  server.listen(process.env.PORT)
})
