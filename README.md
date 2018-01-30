# private-bitcoin

This is a functioning [express](https://www.npmjs.com/package/express) HTTP API written using [indexd](https://www.npmjs.com/package/indexd).

* Requires a running `bitcoind` node
	* with `-txindex`, and
	* ZMQ (`-zmqpubhashtx=tcp://127.0.0.1:30001 -zmqpubhashblock=tcp://127.0.0.1:30001`)
* Change `-rpcworkqueue` from `16` to `32` for increased throughput (in typical scenarios)
