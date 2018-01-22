let { adapter } = require('./indexd')
let bodyParser = require('body-parser')
let bitcoin = require('bitcoinjs-lib')
let parallel = require('run-parallel')
let rpc = require('./rpc')
let typeforce = require('typeforce')
let isHex64 = typeforce.HexN(64)

module.exports = function (router, callback) {
  router.get('/a/:address/txs', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    let height = parseInt(req.query.height)
    if (!Number.isFinite(height)) height = 0

    adapter.transactionIdsByScriptId(scId, height, (err, txIdSet) => {
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

    adapter.transactionIdsByScriptId(scId, height, (err, result) => res.easy(err, Object.keys(result)))
  })

  router.get('/a/:address/seen', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    adapter.seenScriptId(scId, res.easy)
  })

  router.get('/a/:address/unspents', (req, res) => {
    let scId
    try {
      let script = bitcoin.address.toOutputScript(req.params.address)
      scId = bitcoin.crypto.sha256(script).toString('hex')
    } catch (e) { return res.easy(400) }

    adapter.utxosByScriptId(scId, res.easy)
  })

  router.get('/t/:id', (req, res) => {
    if (!isHex64(req.params.id)) return res.status(400).end()

    rpc('getrawtransaction', req.params.id, res.easy)
  })

  router.get('/t/:id/block', (req, res) => {
    if (!isHex64(req.params.id)) return res.status(400).end()

    adapter.blockIdByTransactionId(req.params.id, res.easy)
  })

  router.post('/t/push', bodyParser.text(), (req, res) => {
    rpc('sendrawtransaction', [req.body], (err) => {
      if (err && /./.test(err.message)) return res.easy(err, err.message)
      res.easy(err)
    })
  })

  router.get('/b/:id/header', (req, res) => {
    if (!isHex64(req.params.id)) return res.status(400).end()

    rpc('getblockheader', [req.params.id, true], (err, json) => {
      if (err && /not found/.test(err.message)) return res.easy(err, err.message)
      res.easy(err, json)
    })
  })

  router.get('/b/:id/height', (req, res) => {
    if (!isHex64(req.params.id)) return res.status(400).end()

    rpc('getblockheader', [req.params.id, false], (err, json) => {
      if (err && /not found/.test(err.message)) return res.easy(err, err.message)
      res.easy(err, json)
    })
  })

  router.get('/b/height', (req, res) => {
    rpc('getblockcount', [], res.easy)
  })

  router.get('/b/fees', (req, res) => {
    let count = parseInt(req.query.count)
    if (!Number.isFinite(count)) count = 12
    count = Math.min(count, 64)

    adapter.blockchain.fees(count, (err, results) => {
      if (results) {
        results.forEach((x) => {
          x.kB = Math.floor(x.size / 1024)
        })
      }

      res.easy(err, results)
    })
  })

  function authMiddleware (req, res, next) {
    let auth = bitcoin.crypto.sha256(req.params.pass).toString('base64')
    if (auth !== process.env.APIAUTH) return res.easy(401)
    next()
  }

  router.get('/m/generate', authMiddleware, (req, res) => {
    rpc('generate', [1], res.easy)
  })

  router.get('/m/faucet', authMiddleware, (req, res) => {
    rpc('sendtoaddress', [req.params.address], res.easy)
  })

  callback()
}
