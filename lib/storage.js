'use strict';

var level = require('level');
var NodeCache = require('node-cache');
var Q = require('q');
var storage = {};

storage.put = function (key, value) {
	var debug = require('debug')('node-http-cache:storage:put');
	var deferredDisk = Q.defer();
	var deferredMemory = Q.defer();
	debug('key >> %s', key);
	debug('value >> %j', value);
	storage.db.put(key,value,function callback(err) {
		if (err){
			debug('disk error >> %s',err.stack);
			return deferredDisk.reject(err);
		}else{
			debug('disk value >> %j', value);
			deferredDisk.resolve(value);
		}
	});
	storage.memory.set(key,value,function callback (err) {
		if(err){
			debug('error saving in memory >> %s >> %s', err.message, err.stack);
			return deferredMemory.reject(err);
		}else{
			debug('memory value >> %j',value);
			deferredMemory.resolve(value);
		}
	});
	return Q.all([deferredDisk.promise, deferredMemory.promise])
	.then(function (results) {
		return results[0];
	});
};

storage.init = function (config) {
	var dbLocation = config.location + '/node-http-cache.db';
	storage.db = level(dbLocation,{keyEncoding: 'utf8', valueEncoding: 'json'});
	storage.memory = new NodeCache();
};

storage.get = function (key) {
	var deferred = Q.defer();
	var debug = require('debug')('node-http-cache:storage:get');
	debug('key >> %s', key);
	var result = storage.memory.get(key);
	if (!result){
		result = storage.db.get(key, function callback (err, data) {
			if(err){
				debug('error >> %s', err.stack);
				deferred.reject(err);
			}else{
				debug('from disk: %s >> %j', key, data);
				deferred.resolve(data);
			}
		});
	}else{
		debug('from memory: %s >> %j', key, result);
		deferred.resolve(result);
	}
	return deferred.promise;
};

storage.close = function () {
	var deferred = Q.defer();
	storage.db.close(function (err) {
		if(err){
			deferred.reject(err);
		}else{
			deferred.resolve();
		}
	});
	return deferred.promise;
};

module.exports = storage;