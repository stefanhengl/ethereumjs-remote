const ethereumRemote = require('../ethereum-remote')
const expect = require('chai').expect
const contractBuildArtifact = require('./parkour.json')
const credentials = require('./credentials.json')

function getRandomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const params_base = {
  abi: contractBuildArtifact.abi,
  contractAddress: '0x13ab619da719796aa7a97bf046a51528ac11bd0f',
  provider: credentials.provider,
}

describe('call', function () {
  it('ping should return pong', function () {
    const pongInHex = '0x000000000000000000000000000000000000000000000000' +
      '000000000000002000000000000000000000000000000000000000000000000000' +
      '00000000000004706f6e6700000000000000000000000000000000000000000000' +
      '000000000000'

    params = Object.assign({}, params_base,
      {
        functionName: 'ping',
        functionArguments: [],
      },
    )

    return ethereumRemote.call(params).
      then(res => expect(res).to.equal(pongInHex))
  })
})

describe('sendTransaction', function () {
  it('double should return valid transaction hash', function () {

    const random_int = getRandomInt(1, 20)
    params = Object.assign({}, params_base,
      {
        functionName: 'double',
        functionArguments: [random_int],
        from: credentials.account,
        privateKey: credentials.privateKey,
      })

    return ethereumRemote.sendTransaction(params).
      then(txHash => {
        expect(txHash).to.have.lengthOf(66)
      })
  })
})