'use strict';

const level = require('level');
const Q = require('q');
const _ = require('lodash');
var storage = {};

storage.put = function (key, value) {
	const debug = require('debug')('node-http-cache:storage:put:' + key);
	const deferredDisk = Q.defer();
	storage.db.put(key,value,function callback(err) {
		if (err){
			debug('disk error >> %s',err.stack);
			return deferredDisk.reject(err);
		}else{
			debug('saved to disk');
			deferredDisk.resolve(value);
		}
	});
	storage.memory[key] = value;
	return deferredDisk.promise
	.then(function (result) {
		return result;
	});
};

storage.init = function (config) {
	const dbLocation = config.location + '/node-http-cache.db';
	storage.db = level(dbLocation,{keyEncoding: 'utf8', valueEncoding: 'json'});
	storage.memory = {};
};

storage.get = function (key) {
	const deferred = Q.defer();
	const debug = require('debug')('node-http-cache:storage:get:' + key);
	var result = storage.memory[key];
	if (!result){
		result = storage.db.get(key, function callback (err, data) {
			if(err){
				debug('error >> %s', err.stack);
				deferred.reject(err);
			}else{
				debug('from disk');
				storage.memory[key] = data;
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
	var results = _.keys(storage.memory);
	var deferred = Q.defer();
	if(_.isEmpty(results)){
		var keys = [];
		var keyStream = storage.db.createKeyStream();
		keyStream.on('data', function (key) {
			keys.push(key);
		});
		keyStream.on('end', function () {
			deferred.resolve(keys);
		});
	}
	return _.isEmpty(results) ? deferred.promise : new Q(results);
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