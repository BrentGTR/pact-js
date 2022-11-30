#!/bin/bash -eu
set -e
set -u
set -x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd)" # Figure out where the script is running
. "$SCRIPT_DIR"/lib/robust-bash.sh

require_env_var GIT_REF

npm ci

npm run dist
cp package.json ./dist

export GIT_BRANCH=${GITHUB_HEAD_REF:-${GIT_REF#refs/heads/}}

export PACT_BROKER_USERNAME="dXfltyFMgNOFZAxr8io9wJ37iUpY42M"
export PACT_BROKER_PASSWORD="O5AIZWxelWbLvqMd8PkAVycBJh2Psyg1"

"${SCRIPT_DIR}"/lib/prepare-release.sh

cp package-lock.json dist
cp -r scripts dist
echo "This will be version '$(npx absolute-version)'"

# Link the build so that the examples are always testing the
# current build, in it's properly exported format
(cd dist && npm ci)

echo "Running e2e examples build for node version $(node --version)"
for i in examples/*; do
  [ -d "$i" ] || continue # prevent failure if not a directory
  [ -e "$i" ] || continue # prevent failure if there are no examples
  echo "--> running tests for: $i"
  pushd "$i"
  npm ci
  npm test
  popd
done

echo "--> Running coverage checks"
npm run coverage

echo "Running V3 e2e examples build"

# Commented because:
#    1. We can't run the broker on windows CI
#    2. We use the live broker in the v3 examples now anyway
# docker pull pactfoundation/pact-broker
# BROKER_ID=$(docker run -e PACT_BROKER_DATABASE_ADAPTER=sqlite -d -p 9292:9292 pactfoundation/pact-broker)

# trap "docker kill $BROKER_ID" EXIT

for i in examples/v*/*; do
  [ -d "$i" ] || continue # prevent failure if not a directory
  [ -e "$i" ] || continue # prevent failure if there are no examples
  echo "------------------------------------------------"
  echo "------------> continuing to test V3/v$ example project: $i"
  node --version
  pushd "$i"
  npm ci
  npm test
  popd
done