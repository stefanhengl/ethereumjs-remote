# ethereumjs-remote

`ethereumjs-remote` makes it easy to interact with contracts on
the blockchain without running an Ethereum node locally. It converts your
function call to a transaction, signs it locally, and sends the
signed transaction to your remote provider. All calls to the remote
provider are asynchronous.

## Install
    npm install ethereumjs-remote

## Prerequisites
You need to have access to a provider of a remote node. The code has been tested
with [infura](https://infura.io/).

## Usage

### Transaction

    const ethereumRemote = require('ethereumjs-remote')
     
    // load the contract's ABI, e.g. from the build artifact
    const contractBuildArtifact = require('./contract.json')
    const contractABI = contractBuildArtifact.abi
     

    ethereumRemote.sendTransaction({
      from: '0x43aaE535BE7239c576FA3D152E14b1BC03fF4818',
      privateKey: '*********************************',
      contractAddress: '0x4ab1f10b54915c7324cd4130df90945338f155ad',
      abi: contractABI,
      functionName: 'myFunction',
      functionArguments: [foo, bar],
      provider: https://ropsten.infura.io/a72PYy4LNJBs6BvlszIY
    })
    .then(txHash => console.log(txHash))
    .catch(err => console.log(err))
    
### Message Call

If you want to call a constant function or just want to retrieve a
public state variable, then you send a message call like this:
    
    ethereumRemote.call({
      contractAddress: '0x4ab1f10b54915c7324cd4130df90945338f155ad',
      abi: contractABI,
      functionName: 'myPublicVariable',
      functionArguments: [],
      provider: https://ropsten.infura.io/a72PYy4LNJBs6BvlszIY
    })
    .then(result => console.log(result))
    .catch(err => console.log(err))

## Documentation
  
  [Wiki](https://github.com/stefanhengl/ethereumjs-remote/wiki)