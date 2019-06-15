# Docker Image

This Dockerfile and the surrounding bash scripts will create an image that runs
a regtest instance alongside a node http server that is to be used with the
regtest-client library.

## Build

From this folder, just run:

```bash
docker build -t regtest-server .
```

## Run

And you will have a local image called regtest-server which you can run with
the following command.

```bash
docker run -d -p 8080:8080 regtest-server
```

## Docker Hub

junderw maintains an image of this Dockerfile as
`junderw/bitcoinjs-regtest-server` on Docker Hub.

```bash
# Downloads the image from docker hub automatically
docker run -d -p 8080:8080 junderw/bitcoinjs-regtest-server
```

## BitcoinJS Integration Test Usage

With this running on your computer you can run bitcoinjs integration tests much
faster with the `APIURL` environment variable.

```bash
# Run in the bitcoinjs folder
APIURL=http://localhost:8080/1 npm run integration
```
