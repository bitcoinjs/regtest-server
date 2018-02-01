let { get: indexd } = require('../service')
let bodyParser = require('body-parser')
let bitcoin = require('bitcoinjs-lib')
let debug = require('debug')('1')
let fs = require('fs')
let parallel = require('run-parallel')
let rpc = require('../rpc')
let typeforce = require('typeforce')
let isHex64 = typeforce.HexN(64)

let DBLIMIT = 440 // max sequential leveldb walk
let NETWORK = bitcoin.networks.testnet

function rpcJSON2CB (tx) {
  return {
    txId: tx.hash,
    txHex: tx.hex,
    vsize: tx.vsize,
    version: tx.version,
    locktime: tx.locktime,
    ins: tx.vin.map((x) => {
      return {
        txId: x.txid,
        vout: x.vout,
        script: x.scriptSig.hex,
        sequence: x.sequence
      }
    }),
    outs: tx.vout.map((x) => {
      return {
        address: x.scriptPubKey.addresses ? x.scriptPubKey.addresses[0] : undefined,
        script: x.scriptPubKey.hex,
        value: Math.round(x.value * 1e8) // satoshis
      }
    })
  }
}

module.exports = function (router, callback) {
  function addressWare (req, res, next) {
    try {
      let script = bitcoin.address.toOutputScript(req.params.address, NETWORK)
      req.params.scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }
    next()
  }

  router.get('/a/:address/firstseen', addressWare, (req, res) => {
    let { scId } = req.params
    indexd().firstSeenScriptId(scId, res.easy)
  })

  router.get('/a/:address/txs', addressWare, (req, res) => {
    let { scId } = req.params
    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    indexd().transactionIdsByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, (err, txIds) => {
      if (err) return res.easy(err)

      parallel(txIds.map((txId) => {
        return (next) => rpc('getrawtransaction', [txId], next)
      }), res.easy)
    })
  })

  router.get('/a/:address/txids', addressWare, (req, res) => {
    let { scId } = req.params
    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    indexd().transactionIdsByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, res.easy)
  })

  router.get('/a/:address/txos', addressWare, (req, res) => {
    let { scId } = req.params
    indexd().txosByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, res.easy)
  })

  router.get('/a/:address/unspents', addressWare, (req, res) => {
    let { scId } = req.params
    indexd().utxosByScriptRange({
      scId, heightRange: [0, 0xffffffff], mempool: true
    }, DBLIMIT, res.easy)
  })

  router.get('/t/mempool', (req, res) => {
    rpc('getrawmempool', [false], res.easy)
  })

  router.put('/t/push', bodyParser.text(), (req, res) => {
    rpc('sendrawtransaction', [req.body], (err) => {
      if (err && /./.test(err.message)) return res.easy(err, err.message)
      res.easy(err)
    })
  })

  function hexWare (req, res, next) {
    if (!isHex64(req.params.id)) return res.easy(400)
    next()
  }

  router.get('/t/:id', hexWare, (req, res) => {
    rpc('getrawtransaction', [req.params.id, false], res.easy)
  })

  router.get('/t/:id/json', hexWare, (req, res) => {
    rpc('getrawtransaction', [req.params.id, true], (err, json) => {
      if (err) return res.easy(err)

      res.easy(null, rpcJSON2CB(json))
    })
  })

  router.get('/t/:id/block', hexWare, (req, res) => {
    indexd().blockIdByTransactionId(req.params.id, res.easy)
  })

  router.get('/b/best', (req, res) => {
    rpc('getbestblockhash', [], res.easy)
  })

  router.get('/b/fees', (req, res) => {
    let count = parseInt(req.query.count)
    if (!Number.isFinite(count)) count = 12
    count = Math.min(count, 64)

    indexd().latestFeesForNBlocks(count, (err, results) => {
      if (results) {
        results.forEach((x) => {
          x.kB = Math.floor(x.size / 1024)
        })
      }

      res.easy(err, results)
    })
  })

  function bestInjector (req, res, next) {
    if (req.params.id === 'best') {
      return rpc('getbestblockhash', [], (err, id) => {
        if (err) return next(err)
        req.params.id = id
        next()
      })
    }

    next()
  }

  router.get('/b/:id/header', bestInjector, hexWare, (req, res) => {
    rpc('getblockheader', [req.params.id, false], (err, json) => {
      if (err && /not found/.test(err.message)) return res.easy(err, err.message)
      res.easy(err, json)
    })
  })

  router.get('/b/:id/height', bestInjector, hexWare, (req, res) => {
    rpc('getblockheader', [req.params.id, true], (err, json) => {
      if (err && /not found/.test(err.message)) return res.easy(err, err.message)
      res.easy(err, err ? undefined : json.height)
    })
  })

  let AUTH_KEYS = {}

  // regtest features
  function authMiddleware (req, res, next) {
    if (!req.query.key) return res.easy(401)
    let hash = bitcoin.crypto.sha256(req.query.key).toString('hex')
    if (hash in AUTH_KEYS) return next()
    res.easy(401)
  }

  router.post('/r/generate', authMiddleware, (req, res) => {
    rpc('getnewaddress', [], (err, address) => {
      if (err) return res.easy(err)

      rpc('generatetoaddress', [parseInt(req.query.count) || 1, address], res.easy)
    })
  })

  router.post('/r/faucet', authMiddleware, (req, res) => {
    rpc('sendtoaddress', [req.query.address, parseInt(req.query.value) / 1e8], res.easy)
  })

  fs.readFile(process.env.KEYDB, (err, buffer) => {
    if (err) return callback(err)

    buffer
      .toString('utf8')
      .split('\n')
      .filter(x => x)
      .map(x => bitcoin.crypto.sha256(x).toString('hex')) // XXX: yes, from plain-text :)
      .forEach(x => (AUTH_KEYS[x] = true))
    debug(`imported ${Object.keys(AUTH_KEYS).length} authorized keys`.toUpperCase())

    callback()
  })
}
