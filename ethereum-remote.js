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
 * @param {integer} params.value - (optional) integer of the value in wei send with this transaction
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
 * @param {string} params.from
 * @param {string} params.privateKey
 * @param {string} params.contractAddress
 * @param {array} params.abi
 * @param {string} params.functionName
 * @param {array} params.functionArguments
 * @param {Web3} params.web3
 * @param {integer} params.value - (optional) integer of the value in wei send with this transaction
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

    // hex-encoded nonce
    web3.eth.getTransactionCount(params.from, function (err, res) {
      if (!err) {
        const nonce = res.toString(16)
        web3.eth.getGasPrice(function (err, res) {
          if (!err) {
            const gasPrice = res

            web3.eth.estimateGas({
              to: params.contractAddress,
              data: payloadData,
            }, function (err, res) {
              if (!err) {

                // assemble raw transaction object
                const rawTx = {
                  to: params.contractAddress,
                  data: payloadData,
                  value: web3.toHex(params.value),
                  from: params.from,
                  nonce: '0x' + nonce,
                  gasLimit: web3.toHex(res),
                  gasPrice: '0x' + gasPrice,
                }
                debug('raw transaction:', rawTx)

                // sign and serialize the transaction
                const tx = new EthereumTx(rawTx)
                const privateKeyBuffer = Buffer.from(params.privateKey, 'hex')
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
  sendTransaction,
  call,
  createSignedRawTransaction,
  sendRawTransaction,
}