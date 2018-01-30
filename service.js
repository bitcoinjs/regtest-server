let debug = require('debug')('service')
let debugZmq = require('debug')('service:zmq')
let debugZmqTx = require('debug')('service:zmq:tx')
let Indexd = require('indexd')
let leveldown = require('leveldown')
let rpc = require('./rpc')
let zmq = require('zmq')

let db = leveldown(process.env.INDEXDB)
let indexd = new Indexd(db, rpc)

module.exports = function initialize (callback) {
  function errorSink (err) {
    if (err) debug(err)
  }

  debug(`Opening leveldb @ ${process.env.INDEXDB}`)
  db.open({
    writeBufferSize: 1 * 1024 * 1024 * 1024 // 1 GiB
  }, (err) => {
    if (err) return callback(err)
    debug(`Opened leveldb @ ${process.env.INDEXDB}`)

    let zmqSock = zmq.socket('sub')
    zmqSock.connect(process.env.ZMQ)
    zmqSock.subscribe('hashblock')
    zmqSock.subscribe('hashtx')

    let lastSequence = 0
    zmqSock.on('message', (topic, message, sequence) => {
      topic = topic.toString('utf8')
      message = message.toString('hex')
      sequence = sequence.readUInt32LE()

      // were any ZMQ messages were lost?
      let expectedSequence = lastSequence + 1
      lastSequence = sequence
      if (sequence !== expectedSequence) {
        if (sequence < expectedSequence) debugZmq(`bitcoind may have restarted`)
        else debugZmq(`${sequence - expectedSequence} messages lost`)
        indexd.tryResync(errorSink)
      }

      switch (topic) {
        case 'hashblock': {
          debugZmq(topic, message)
          return indexd.tryResync(errorSink)
        }

        case 'hashtx': {
          debugZmqTx(topic, message)
          return indexd.notify(message, errorSink)
        }
      }
    })

    setInterval(() => indexd.tryResync(errorSink), 60000) // attempt every minute
    indexd.tryResync(errorSink)

    callback()
  })
}

module.exports.get = function get () {
  return indexd
}
