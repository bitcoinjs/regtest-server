let leveldown = require('leveldown')
let Indexd = require('indexd')
let rpc = require('../rpc')
let { types: txoTypes } = require('indexd/indexes/txo')

function debug () {
  if (arguments[0] instanceof Error) console.error.apply(null, arguments)
  else console.log.apply(null, arguments)
}

let db = leveldown(process.env.INDEXDB)
let indexd = new Indexd(db, rpc)

db.open({}, (err) => {
  if (err) return debug(err)

  let atomic = indexd.db.atomic()
  atomic.del(txoTypes.tip, {})
  atomic.write((err) => {
    if (err) debug(err)
    debug('FIN')
  })
})
