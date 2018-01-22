require('easy-express-api')({
  debug: require('debug')('api'),
  port: process.env.PORT,
  routes: {
    '/1': require('./routes/1')
  },
  services: {
    'indexd': require('./service')
  }
})
