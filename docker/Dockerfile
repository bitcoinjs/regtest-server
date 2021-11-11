FROM ubuntu:18.04
MAINTAINER Jonathan Underwood

RUN apt update && apt install -y software-properties-common

RUN apt update && \
   apt install -y \
   curl \
   wget \
   tar \
   python \
   build-essential \
   gnupg2 \
   libzmq3-dev \
   libsnappy-dev && \
   curl --silent --location https://deb.nodesource.com/setup_10.x | bash -

WORKDIR /root

COPY achow.asc ./

RUN gpg --import achow.asc && \
  wget https://bitcoincore.org/bin/bitcoin-core-22.0/SHA256SUMS && \
  wget https://bitcoincore.org/bin/bitcoin-core-22.0/SHA256SUMS.asc && \
  wget https://bitcoincore.org/bin/bitcoin-core-22.0/bitcoin-22.0-x86_64-linux-gnu.tar.gz && \
  sha256sum --ignore-missing --check SHA256SUMS && \
  (gpg --verify SHA256SUMS.asc 2>&1 | grep "Good signature from \"Andrew Chow" || exit 1) && \
  tar xvf bitcoin-22.0-x86_64-linux-gnu.tar.gz && \
  rm -f bitcoin-22.0-x86_64-linux-gnu.tar.gz SHA256SUM* achow.asc && \
  cp -R bitcoin-22.0/* /usr/ && \
  rm -rf bitcoin-22.0/

RUN apt install -y \
  git \
  vim \
  nodejs && \
  mkdir /root/regtest-data && \
  echo "satoshi" > /root/regtest-data/KEYS

COPY run_regtest_app.sh run_bitcoind_service.sh install_leveldb.sh ./

RUN chmod +x install_leveldb.sh && \
  chmod +x run_bitcoind_service.sh && \
  chmod +x run_regtest_app.sh && \
  ./install_leveldb.sh

RUN git clone https://github.com/bitcoinjs/regtest-server.git
WORKDIR /root/regtest-server

# Change the checkout branch if you need to. Must fetch because of Docker cache
# RUN git fetch origin && \
#   git checkout ebee446d7c3b9071633764b39cdca3ac1b28d253

RUN npm i

ENTRYPOINT ["/root/run_regtest_app.sh"]

EXPOSE 8080
