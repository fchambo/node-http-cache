'use strict';

const debugFactory = require('debug');
const _ = require('lodash');
const util = require('util');
const Q = require('q');

function builderFactory (serviceName,index) {
	const debug = debugFactory('node-http-cache:indexes:builderFactory');
	return function indexBuilder(element,alreadySavedIndex) {
		debug('serviceName >> %s',serviceName);
		debug('index >> %s', index);
		debug('element[index] >> %s', element[index]);
		var storageKey = util.format('%s_%s_%s',serviceName,index,element[index]);
		debug('storageKey >> %s',storageKey);
		var storage = require('./storage');
		return storage.get(storageKey)
		.then(
			function (dbElements) {
				debug('dbElements >> %j', dbElements);
				let saveElements = [];
				if(alreadySavedIndex){
					saveElements = dbElements;
				}
				saveElements.push(element);
				return storage.put(storageKey,saveElements);
			},
			function (err) {
				debug('err >> %s', err.stack);
				let saveElements = [];
				saveElements.push(element);
				return storage.put(storageKey,saveElements);
			}
		);
	};
}

exports.build = function (config) {
	const debug = debugFactory('node-http-cache:indexes:build:' + config.name);
	
	const indexes = config.indexes; 
	const data = config.data;
	debug('data.length >> %s', data.length);
	var indexBuilders = [];
	var savedIndexes = {};
	var promises = [];
	function processStep (data, index, stepSize) {
		if(index >= 0){
			debug('processing index %s', index);
			_.forEach(indexBuilders, function (indexBuilder) {
				let storageKey = util.format('%s_%s_%s',indexBuilder.name,indexBuilder.indexKey,data[index][indexBuilder.indexKey]);
				if(storageKey === 'cities_id_1342108'){
					debug('FOUND cities_id_1342108 >> %s',storageKey);
				}
				promises.push(indexBuilder.buildIndex(data[index], savedIndexes[storageKey]));
				debug('processed index >> %s',index);
			});
			if (index > 0 && index % stepSize === 0){
				debug('processed until %s', index+1);
				return Q.all(promises)
				.then(function () {
					debug('continuing...');
					promises = [];
					return processStep(data,index-1,stepSize);
				});
			}else{
				return processStep(data,index-1,stepSize);
			}
		}
	}
	_.forEach(indexes,function (index) {
		indexBuilders.push({
			name: config.name,
			indexKey: index,
			buildIndex:builderFactory(config.name,index)
		});
	});
	debug('indexes >> %s', indexes);
	//debug('data >> %j', data);
	debug('indexBuilders >> %j', indexBuilders);
	var stepSize = 50;
	return processStep(data,data.length-1,stepSize);
};