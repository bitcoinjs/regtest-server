let leveldown = require('leveldown')
let db = leveldown(process.env.INDEXDB)
let SCRIPTTYPE = require('indexd/indexes/script').TYPE

function debug () {
  if (arguments[0] instanceof Error) console.error.apply(null, arguments)
  else console.log.apply(null, arguments)
}

let MIN64 = '0000000000000000000000000000000000000000000000000000000000000000'
let MAX64 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

db.open({}, (err) => {
  if (err) return debug(err)
  db = require('../dbwrapper')(db)

  let i = 0
  db.iterator(SCRIPTTYPE, {
    gte: { scId: MIN64, height: 0, txId: MIN64, vout: 0 },
    lte: { scId: MAX64, height: 0xffffffff, txId: MAX64, vout: 0xffffffff }
  }, (key, value) => {
    debug('KV', i, key, value)
    ++i
  }, (err) => {
    if (err) debug(err)
    debug('FIN')
  })
})
