const fs = require('fs');
let auth;

if (process.env.RPCOOKIE) {
  try {
    auth = fs.readFileSync(process.env.RPCCOOKIE);
  } catch (e) {
    console.log(e);
  }
}

if (process.env.RPCAUTH) {
    auth = process.env.RPCAUTH;
}

if (!auth) {
  console.log(`RPCAUTH or RPCOOKIE must be specified`);
}

module.exports = require('yajrpc/qup')({
  url: process.env.RPC || 'http://localhost:8332',
  auth: auth,
  batch: process.env.RPCBATCHSIZE || 500,
  concurrent: process.env.RPCCONCURRENT || 16
})
