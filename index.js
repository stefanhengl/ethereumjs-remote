ethereumRemote = require('./ethereum-remote')

exports.sendTransaction = ethereumRemote.sendTransaction
exports.call= ethereumRemote.call
exports.createSignedRawTransaction = ethereumRemote.createSignedRawTransaction
exports.sendRawTransaction = ethereumRemote.sendRawTransaction
