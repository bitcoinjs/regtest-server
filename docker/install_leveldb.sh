#!/usr/bin/env bash

# Install LevelDB
export VER="1.20"
wget https://github.com/google/leveldb/archive/v${VER}.tar.gz
tar xvf v${VER}.tar.gz
rm -f v${VER}.tar.gz
cd leveldb-${VER}
make
scp -r out-static/lib* out-shared/lib* "/usr/local/lib"
cd include
scp -r leveldb /usr/local/include
ldconfig
cd ../..
rm -rf leveldb-${VER}/
