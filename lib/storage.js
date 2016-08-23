'use strict';

const level = require('level');
var NodeCache = require('node-cache');
const Q = require('q');
var storage = {};

storage.put = function (key, value) {
	const debug = require('debug')('node-http-cache:storage:put:' + key);
	const deferredDisk = Q.defer();
	const deferredMemory = Q.defer();
	storage.db.put(key,value,function callback(err) {
		if (err){
			debug('disk error >> %s',err.stack);
			return deferredDisk.reject(err);
		}else{
			debug('saved to disk');
			deferredDisk.resolve(value);
		}
	});
	storage.memory.set(key,value,function callback (err) {
		if(err){
			debug('error saving in memory >> %s >> %s', err.message, err.stack);
			return deferredMemory.reject(err);
		}else{
			debug('saved to memory');
			deferredMemory.resolve(value);
		}
	});
	return Q.all([deferredDisk.promise, deferredMemory.promise])
	.then(function (results) {
		return results[0];
	});
};

storage.init = function (config) {
	const dbLocation = config.location + '/node-http-cache.db';
	storage.db = level(dbLocation,{keyEncoding: 'utf8', valueEncoding: 'json'});
	storage.memory = new NodeCache();
};

storage.get = function (key) {
	const deferred = Q.defer();
	const debug = require('debug')('node-http-cache:storage:get:' + key);
	let result = storage.memory.get(key);
	if (!result){
		result = storage.db.get(key, function callback (err, data) {
			if(err){
				debug('error >> %s', err.stack);
				deferred.reject(err);
			}else{
				debug('from disk');
				storage.memory.set(key,data);
				deferred.resolve(data);
			}
		});
	}else{
		debug('from memory');
		deferred.resolve(result);
	}
	return deferred.promise;
};

storage.getKeys = function () {
	var deferred = Q.defer();
	var keys = [];
	var keyStream = storage.db.createKeyStream();
	keyStream.on('data', function (key) {
		keys.push(key);
	});
	keyStream.on('end', function () {
		deferred.resolve(keys);
	});
	return deferred.promise;
};

storage.close = function () {
	const deferred = Q.defer();
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