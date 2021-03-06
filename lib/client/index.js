// Copyright 2013 Mark Cavage, Inc.  All rights reserved.

var assert = require('assert-plus');

var Logger = require('bunyan');

var Client = require('./client');
var ClientPool = require('./pool');



///--- Globals

var DEF_LOG = new Logger({
  name: 'ldapjs',
  component: 'client',
  stream: process.stderr,
  serializers: Logger.stdSerializers
});



///--- Functions

function xor() {
  var b = false;
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] && !b) {
      b = true;
    } else if (arguments[i] && b) {
      return false;
    }
  }
  return b;
}



///--- Exports

module.exports = {

  createClient: function createClient(options) {
    assert.object(options, 'options');
    if (options.url && typeof (options.url) !== 'string')
      throw new TypeError('options.url (string) required');
    if (options.socketPath && typeof (options.socketPath) !== 'string')
      throw new TypeError('options.socketPath must be a string');
    if (!xor(options.url, options.socketPath))
      throw new TypeError('options.url ^ options.socketPath (String) required');
    if (!options.log)
      options.log = DEF_LOG;
    assert.object(options.log, 'options.log');

    if (options.maxConnections && options.maxConnections > 1)
      return new ClientPool(options);

    return new Client(options);
  }

};
