const debug = require('debug')('ethereumjs-remote')
const EthereumTx = require('ethereumjs-tx')
const Joi = require('joi')
const SolidityFunction = require('web3/lib/web3/function')
const Web3 = require('web3')
const _ = require('lodash')

const schema = {
  from: Joi.string().required(),
  privateKey: Joi.string().required(),
  contractAddress: Joi.string().required(),
  abi: Joi.array().required(),
  functionName: Joi.string().required(),
  functionArguments: Joi.array().required(),
  provider: Joi.string().required(),
}

/**
 * Wrapper function that creates, signs, and sends a raw transaction
 * @param {object} params - object containing all required parameters
 * @param {string} params.from - account that pays for the transaction
 * @param {string} params.privateKey - the key of the account specified in 'from'
 * @param {string} params.contractAddress - the address of the contract you want to interact with
 * @param {array} params.abi - the abi of the contract you want to interact with
 * @param {string} params.functionName - the name of the function you want to call
 * @param {array} params.functionArguments - the arguments in an array
 * @param {string} params.provider - the url of the provider of the remote node
 * @returns {Promise}
 */
const callContractFunction = function (params) {
  const result = Joi.validate(params, schema)
  if (result.error) {
    throw result.error
  }

  return new Promise((resolve, reject) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(params.provider))

    createSignedRawTransaction(params.from, params.privateKey,
      params.contractAddress, params.abi, params.functionName,
      params.functionArguments, web3).
      then(rawTransaction => sendRawTransaction(rawTransaction, web3)).
      then(txHash => resolve(txHash)).
      catch(err => reject(err))
  })

}

/**
 * Creates a raw transaction object and signs it with ethereumjs-tx.
 * The purpose of this function is to take care of the tedious formatting
 * and hex-encoding required for creating a raw transaction
 * @param from
 * @param {string} privateKey
 * @param {string} contractAddress
 * @param {array} abi
 * @param {string} functionName
 * @param {array} functionArguments
 * @param {Web3} web3
 * @returns {Promise}
 */
const createSignedRawTransaction = (
  from, privateKey, contractAddress, abi, functionName,
  functionArguments, web3) => {

  return new Promise((resolve, reject) => {
    debug('creating transaction object')

    // create payload
    const functionDef = new SolidityFunction('',
      _.find(abi, {name: functionName}), '')
    const payloadData = functionDef.toPayload(functionArguments).data

    // hex-encoded nonce
    web3.eth.getTransactionCount(from, function (err, res) {
      if (!err) {
        const nonce = res.toString(16)
        web3.eth.getGasPrice(function (err, res) {
          if (!err) {
            const gasPrice = res

            web3.eth.estimateGas({
              to: contractAddress,
              data: payloadData,
            }, function (err, res) {
              if (!err) {

                // assemble raw transaction object
                const rawTx = {
                  to: contractAddress,
                  data: payloadData,
                  value: '0x0',
                  from: from,
                  nonce: '0x' + nonce,
                  gasLimit: web3.toHex(res),
                  gasPrice: '0x' + gasPrice,
                }
                debug('raw transaction:', rawTx)

                // sign and serialize the transaction
                const tx = new EthereumTx(rawTx)
                const privateKeyBuffer = Buffer.from(privateKey, 'hex')
                tx.sign(privateKeyBuffer)
                const serializedTx = tx.serialize()
                debug('transaction signed and serialized')

                resolve('0x' + serializedTx.toString('hex'))
              } else {
                reject(err)
              }
            })
          } else {
            reject(err)
          }
        })
      } else {
        reject(err)
      }
    })

  })
}

/**
 * Promise based version of web3.eth.sendRawTransaction
 * @param {string} rawTransaction - signed and serialized transaction. Output from createSignedRawTransaction.
 * @param {Web3} web3
 * @returns {Promise}
 */
const sendRawTransaction = (rawTransaction, web3) => {
  debug('sending transaction')
  return new Promise((resolve, reject) => {
    web3.eth.sendRawTransaction(rawTransaction, function (err, hash) {
      if (!err) {
        resolve(hash)
      } else {
        reject(err)
      }
    })
  })
}

module.exports = {
  callContractFunction,
  createSignedRawTransaction,
  sendRawTransaction
}