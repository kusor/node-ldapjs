// Copyright 2013 Mark Cavage, Inc.  All rights reserved.
// vim: set ts=4 sts=4 sw=4 et:
var Logger = require('bunyan');

var test = require('tap').test;
var libuuid = require('libuuid');
var util = require('util');

var ldap = require('../lib/index');

///--- Globals

var BIND_DN = 'cn=root';
var BIND_PW = 'secret';
var SOCKET = '/tmp/.' + libuuid.create();

var SUFFIX = 'dc=test';
var server;

test('setup', function (t) {
    t.ok(ldap, 'ldap');
    t.ok(ldap.createClient, 'createClient');
    t.ok(ldap.createServer, 'createServer');


    server = ldap.createServer();
    t.ok(server, 'server');

    server.bind(BIND_DN, function (req, res, next) {
        if (req.credentials !== BIND_PW) {
            return next(new ldap.InvalidCredentialsError('Invalid password'));
        }

        res.end();
        return next();
    });

    server.unbind(function (req, res, next) {
        res.end();
        return next();
    });

    t.end();
});


test('fail after a number of retries', function (t) {
    var client = ldap.createClient({
        connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
        socketPath: SOCKET,
        maxConnections: parseInt(process.env.LDAP_MAX_CONNS || 1, 10),
        idleTimeoutMillis: 10,
        retry: {
            retries: 3
        },
        log: new Logger({
            name: 'ldapjs_unit_test',
            stream: process.stderr,
            level: (process.env.LOG_LEVEL || 'info'),
            serializers: Logger.stdSerializers,
            src: true
        })
    });
    t.ok(client, 'client ok');
    client.once('error', function (err) {
        t.ok(err, 'connection failed after some retries');
        t.end();
    });
});


test('retries timeout', function (t) {
    var client = ldap.createClient({
        connectTimeout: 2000,
        socketPath: SOCKET,
        maxConnections: parseInt(process.env.LDAP_MAX_CONNS || 1, 10),
        idleTimeoutMillis: 10,
        log: new Logger({
            name: 'ldapjs_unit_test',
            stream: process.stderr,
            level: (process.env.LOG_LEVEL || 'info'),
            serializers: Logger.stdSerializers,
            src: true
        })
    });
    t.ok(client, 'client ok');
    client.once('connectTimeout', function (err) {
        t.ok(err, 'connection failed after connectTimeout');
        t.end();
    });
});


test('Retries by default', function (t) {
    var client = ldap.createClient({
        connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT || 0, 10),
        socketPath: SOCKET,
        maxConnections: parseInt(process.env.LDAP_MAX_CONNS || 1, 10),
        idleTimeoutMillis: 10,
        log: new Logger({
            name: 'ldapjs_unit_test',
            stream: process.stderr,
            level: (process.env.LOG_LEVEL || 'info'),
            serializers: Logger.stdSerializers,
            src: true
        })
    });
    t.ok(client, 'client ok');

    client.once('connect', function connected(socket) {
        client.removeListener('connect', connected);
        t.ok(socket, 'client socket ok');
        t.ok(socket.writable, 'client socket is writable');
        // Now we'll close the socket and verify it reconnects:

        // First we'll receive close event
        client.once('close', function closed(err) {
            client.removeListener('close', closed);
            t.ifError(err, 'client close due to socket error ok');
        });

        // Then, connect event once it's connected again
        client.once('connect', function reconnected(sock) {
            client.removeListener('connect', reconnected);
            client.once('close', function (err) {
                t.ifError(err, 'client intentionally closed error ok');
                t.end();
            });
            // This shouldn't be reached:
            client.once('connect', function () {
                t.ok(false, 'we should not reconnect after client.close');
            });

            t.ok(sock, 'client reconnect socket ok');
            // Explictly close client now, and make sure we don't reconnect:
            client.close(function () {
                t.ok(true, 'calling client.close()');
            });
        });

        socket.destroy();

    });

    setTimeout(function () {
        server.listen(SOCKET, function () {
            // Nothing to do here really
        });
    }, 1000);
});


test('teardown', function (t) {
    server.on('close', function () {
        t.end();
    });
    server.close();
});
