let debug = require('debug')('service')
let debugZmq = require('debug')('service:zmq')
let debugZmqTx = require('debug')('service:zmq:tx')
let Indexd = require('indexd')
let leveldown = require('leveldown')
let rpc = require('./rpc')
let zmq = require('zeromq')

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

    let sequences = {}
    zmqSock.on('message', (topic, message, sequence) => {
      topic = topic.toString('utf8')
      message = message.toString('hex')
      sequence = sequence.readUInt32LE()

      if (sequences[topic] === undefined) sequences[topic] = sequence
      else sequences[topic] += 1

      if (sequence !== sequences[topic]) {
        if (sequence < sequences[topic]) debugZmq(`bitcoind may have restarted`)
        else debugZmq(`${sequence - sequences[topic]} messages lost`)
        sequences[topic] = sequence
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
    indexd.tryResyncMempool(errorSink) // only necessary once

    callback()
  })
}

module.exports.get = function get () {
  return indexd
}
