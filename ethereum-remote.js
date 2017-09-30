const debug = require('debug')('ethereumjs-remote')
const EthereumTx = require('ethereumjs-tx')
const Joi = require('joi')
const SolidityFunction = require('web3/lib/web3/function')
const Web3 = require('web3')
const _ = require('lodash')

const schema_sendTransaction = {
  from: Joi.string().required(),
  privateKey: Joi.string().required(),
  contractAddress: Joi.string().required(),
  abi: Joi.array().required(),
  functionName: Joi.string().required(),
  functionArguments: Joi.array().required(),
  provider: Joi.string().required(),
  value: Joi.number().integer(),
  gasLimit: Joi.number().integer(),
}

const schema_call = {
  contractAddress: Joi.string().required(),
  abi: Joi.array().required(),
  functionName: Joi.string().required(),
  functionArguments: Joi.array().required(),
  provider: Joi.string().required(),
}

const schema_createSignedRawTransaction = {
  from: Joi.string().required(),
  privateKey: Joi.string().required(),
  contractAddress: Joi.string().required(),
  abi: Joi.array().required(),
  functionName: Joi.string().required(),
  functionArguments: Joi.array().required(),
  web3: Joi.any().required(),
  value: Joi.number().integer(),
  gasLimit: Joi.number().integer(),
}

/**
 * Wrapper function that creates, signs, and sends a raw transaction.
 * transactions you send with this function will typically be state-changing
 * and thus be included in the blockchain
 * @param {object} params - object containing all required parameters
 * @param {string} params.from - account that pays for the transaction
 * @param {string} params.privateKey - the key of the account specified in 'from'
 * @param {string} params.contractAddress - the address of the contract you want to interact with
 * @param {array} params.abi - the abi of the contract you want to interact with
 * @param {string} params.functionName - the name of the function you want to call
 * @param {array} params.functionArguments - the arguments in an array
 * @param {string} params.provider - the url of the provider of the remote node
 * @param {integer} params.value - (optional) value in wei you want to send with this transaction
 * @param {integer} params.gasLimit - (optional) if not provided, the gasLimit will be estimated
 * @returns {Promise}
 */
const sendTransaction = (params) => {
  const result = Joi.validate(params, schema_sendTransaction)
  if (result.error) {
    throw result.error
  }

  return new Promise((resolve, reject) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(params.provider))
    createSignedRawTransaction(
      _.assign(_.omit(params, ['provider']), {web3: web3})).
      then(rawTransaction => sendRawTransaction(rawTransaction, web3)).
      then(txHash => resolve(txHash)).
      catch(err => reject(err))
  })

}
/**
 * Sends a message call to a contract. Use this function to read state variables
 * or to call constant functions
 * @param {object} params - object containing all required parameters
 * @param {string} params.contractAddress - the address of the contract you want to interact with
 * @param {array} params.abi - the abi of the contract you want to interact with
 * @param {string} params.functionName - the name of the function you want to call
 * @param {array} params.functionArguments - the arguments in an array
 * @param {string} params.provider - the url of the provider of the remote node
 * @returns {Promise}
 */
const call = (params) => {
  const result = Joi.validate(params, schema_call)
  if (result.error) {
    throw result.error
  }

  return new Promise((resolve, reject) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(params.provider))

    const functionDef = new SolidityFunction('',
      _.find(params.abi, {name: params.functionName}), '')
    const payloadData = functionDef.toPayload(params.functionArguments).data
    web3.eth.call(
      {'to': params.contractAddress, 'data': payloadData},
      function (err, res) {
        if (!err) {
          resolve(res)
        } else {
          reject(err)
        }
      })

  })
}

/**
 * Creates a raw transaction object and signs it with ethereumjs-tx.
 * The purpose of this function is to take care of the tedious formatting
 * and hex-encoding required for creating a raw transaction
 * @param {object} params - object containing all required parameters
 * @param {string} params.from - account that pays for the transaction
 * @param {string} params.privateKey - the key of the account specified in 'from'
 * @param {string} params.contractAddress - the address of the contract you want to interact with
 * @param {array} params.abi - the abi of the contract you want to interact with
 * @param {string} params.functionName - the name of the function you want to call
 * @param {array} params.functionArguments - the arguments in an array
 * @param {Web3} params.web3 - Web3 instance
 * @param {integer} params.value - (optional) value in wei you want to send with this transaction
 * @param {integer} params.gasLimit - (optional) if not provided, the gasLimit will be estimated
 * @returns {Promise}
 */
const createSignedRawTransaction = (params) => {
  const result = Joi.validate(params, schema_createSignedRawTransaction)
  if (result.error) {
    throw result.error
  }

  if (!params.hasOwnProperty('value')) {
    params.value = 0
  }

  return new Promise((resolve, reject) => {
    debug('creating transaction object')
    const web3 = params.web3
    // create payload
    const functionDef = new SolidityFunction('',
      _.find(params.abi, {name: params.functionName}), '')
    const payloadData = functionDef.toPayload(params.functionArguments).data

    // get nonce
    web3.eth.getTransactionCount(params.from, function (err, nonce) {
      if (!err) {
        debug('nonce:', nonce)

        // get gasPrice
        web3.eth.getGasPrice(function (err, res) {
          if (!err) {
            const gasPrice = res
            debug('gasPrice:', res)

            // Check if user supplied gasLimit. If yes, take it, if not,
            // estimate it
            if (typeof(params.gasLimit) !== 'undefined') {
              debug('user supplied gasLimit:', params.gasLimit)
              const serializedTx = sign_and_serialize(params, nonce,
                payloadData, gasPrice, params.gasLimit)

              resolve('0x' + serializedTx.toString('hex'))
            } else {
              web3.eth.estimateGas({
                to: params.contractAddress,
                data: payloadData,
              }, function (err, res) {
                if (!err) {
                  debug('estimated gasLimit:', res)
                  const serializedTx = sign_and_serialize(params, nonce,
                    payloadData, gasPrice, res)

                  resolve('0x' + serializedTx.toString('hex'))
                } else {
                  reject(err)
                }
              })
            }
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
 * Helper function, takes care of hex-encoding, signing, and serializing
 * @param {object} params - see params of createSignedRawTransaction
 * @param {integer} nonce
 * @param payloadData - output of SolidityFunction.toPayload
 * @param {BigNumber} gasPrice
 * @param {integer} gasLimit
 * @returns {string} serialized and signed transaction
 */
const sign_and_serialize = (params, nonce, payloadData, gasPrice, gasLimit) => {
  const rawTx = {
    to: params.contractAddress,
    data: payloadData,
    value: params.web3.toHex(params.value),
    from: params.from,
    nonce: params.web3.toHex(nonce),
    gasLimit: params.web3.toHex(gasLimit),
    gasPrice: params.web3.toHex(gasPrice),
  }
  debug('raw transaction:', rawTx)

  // sign and serialize the transaction
  const tx = new EthereumTx(rawTx)
  const privateKeyBuffer = Buffer.from(params.privateKey, 'hex')
  tx.sign(privateKeyBuffer)
  const serializedTx = tx.serialize()
  debug('transaction signed and serialized')
  return serializedTx
}

/**
 * Promise based version of web3.eth.sendRawTransaction
 * @param {string} rawTransaction - signed and serialized transaction. Output from createSignedRawTransaction.
 * @param {Web3} web3 - Web3 instance
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
  sendTransaction,
  call,
  createSignedRawTransaction,
  sendRawTransaction,
}