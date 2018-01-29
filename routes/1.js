let { get: indexd } = require('../service')
let bodyParser = require('body-parser')
let bitcoin = require('bitcoinjs-lib')
let parallel = require('run-parallel')
let rpc = require('../rpc')
let typeforce = require('typeforce')
let isHex64 = typeforce.HexN(64)

let API_KEYS = {}
require('fs')
  .readFileSync(process.env.KEYDB)
  .toString('utf8')
  .split('\n')
  .forEach(x => (API_KEYS[x] = true))

module.exports = function (router, callback) {
  router.get('/a/:address/txs', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    indexd().transactionIdsByScriptId(scId, height, (err, txIdSet) => {
      if (err) return res.easy(err)

      let tasks = {}
      for (let txId in txIdSet) {
        tasks[txId] = (next) => rpc('getrawtransaction', [txId], next)
      }

      parallel(tasks, res.easy)
    })
  })

  router.get('/a/:address/txids', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    indexd().transactionIdsByScriptId(scId, height, (err, result) => res.easy(err, Object.keys(result)))
  })

  router.get('/a/:address/seen', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    indexd().seenScriptId(scId, res.easy)
  })

  router.get('/a/:address/unspents', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    indexd().utxosByScriptId(scId, res.easy)
  })

  router.get('/t/:id', (req, res) => {
    if (!isHex64(req.params.id)) return res.easy(400)

    rpc('getrawtransaction', req.params.id, res.easy)
  })

  router.get('/t/:id/block', (req, res) => {
    if (!isHex64(req.params.id)) return res.easy(400)

    indexd().blockIdByTransactionId(req.params.id, res.easy)
  })

  router.post('/t/push', bodyParser.text(), (req, res) => {
    rpc('sendrawtransaction', [req.body], (err) => {
      if (err && /./.test(err.message)) return res.easy(err, err.message)
      res.easy(err)
    })
  })

  router.get('/b/best', (req, res) => {
    rpc('getbestblockhash', [], res.easy)
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

  router.get('/b/:id/header', bestInjector, (req, res) => {
    if (!isHex64(req.params.id)) return res.easy(400)

    rpc('getblockheader', [req.params.id, true], (err, json) => {
      if (err && /not found/.test(err.message)) return res.easy(err, err.message)
      res.easy(err, json)
    })
  })

  router.get('/b/:id/height', bestInjector, (req, res) => {
    if (!isHex64(req.params.id)) return res.easy(400)

    rpc('getblockheader', [req.params.id, false], (err, json) => {
      if (err && /not found/.test(err.message)) return res.easy(err, err.message)
      res.easy(err, json && json.height)
    })
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

  function authMiddleware (req, res, next) {
    // XXX: this isnt safe
    if (req.query.key in API_KEYS) return res.easy(401)
    next()
  }

  router.post('/m/generate', authMiddleware, (req, res) => {
    rpc('generate', [1], res.easy)
  })

  router.post('/m/faucet', authMiddleware, (req, res) => {
    rpc('sendtoaddress', [req.query.address, 0.001], res.easy)
  })

  callback()
}
