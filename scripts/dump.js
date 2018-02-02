let bitcoin = require('bitcoinjs-lib')
let leveldown = require('leveldown')
let Indexd = require('indexd')
let rpc = require('../rpc')
let { types: scriptTypes } = require('indexd/indexes/script')

let db = leveldown(process.env.INDEXDB)
let indexd = new Indexd(db, rpc)

function debug () {
  if (arguments[0] instanceof Error) console.error.apply(null, arguments)
  else console.log.apply(null, arguments)
}

let MIN64 = '0000000000000000000000000000000000000000000000000000000000000000'
let MAX64 = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

db.open({}, (err) => {
  if (err) return debug(err)

  let i = 0
  indexd.db.iterator(scriptTypes.data, {
    gte: { scId: MIN64, height: 0, txId: MIN64, vout: 0 },
    lte: { scId: MAX64, height: 0xffffffff, txId: MAX64, vout: 0xffffffff }
  }, (key, value) => {
    let y = i
    indexd.txoByTxo(key, (err, txo) => {
      if (err) return

      let extra = {}
      try {
        extra.address = bitcoin.address.fromOutputScript(txo.script, bitcoin.networks.testnet)
      } catch (e) { extra.asm = bitcoin.script.toASM(txo.script) }
      extra.script = txo.script.toString('hex')

      debug('ST', y, Object.assign(key, value, txo, extra))
    })

    ++i
  }, (err) => {
    if (err) debug(err)
    debug('FIN')
  })
})
