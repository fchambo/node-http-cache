'use strict';
const debugFactory = require('debug');
const _ = require('lodash');
const Q = require('q');

exports.build = function (config) {
	const debug = debugFactory('node-http-cache:indexes:build:' + config.name);
	
	const indexes = config.indexes; 
	const data = config.data;
	debug('data.length >> %s', data.length);
	var result = {};
	function processStep (element, dataIndex, indexKey) {
		if(dataIndex < 0){
			return result;
		}else{
			if(!result[indexKey][element[indexKey]]){
				result[indexKey][element[indexKey]] = [];
			}
			result[indexKey][element[indexKey]].push(element); 
			return result;
		}
	}
	var promises = [];
	_.forEach(indexes,function (index) {
		result[index] = {};
		_.forEachRight(data, function (element, key) {
			var deferred = Q.defer();
			setImmediate(function () {
				processStep(element,key,index);
				deferred.resolve();
			});
			promises.push(deferred.promise);
		});
	});
	return Q.all(promises)
	.then(function () {
		return result;
	});
};