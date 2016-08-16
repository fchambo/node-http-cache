'use strict';

const debugFactory = require('debug');
const _ = require('lodash');
const util = require('util');

function builderFactory (index,indexData) {
	const debug = debugFactory('node-http-cache:indexes:builderFactory');
	debug('index >> %s', index);
	debug('indexData >> %j', indexData);
	return function indexBuilder(element,key) {
		const debug = debugFactory('node-http-cache: indexBuilder');
		debug('indexData[element[index]] >> %j',indexData[element[index]]);
		if(!indexData[element[index]]){
			indexData[element[index]] = [];
		}
		indexData[element[index]].push(key);
	};
}

exports.build = function (config) {
	const debug = debugFactory('node-http-cache:indexes:build');
	const indexes = config.indexes; 
	const data = config.data;
	var indexBuilders = [];
	_.forEach(indexes,function (index) {
		var indexData = {};
		indexBuilders.push({
			indexKey: index,
			indexData:indexData,
			indexBuilder:builderFactory(index,indexData)
		});
	});
	var result = {};
	debug('indexes >> %s', indexes);
	//debug('data >> %j', data);
	debug('indexBuilders >> %j', indexBuilders);
	_.forEach(data, function (element, key) {
		_.forEach(indexBuilders, function (indexBuilder) {
			if (!result[indexBuilder.indexKey]){
				result[indexBuilder.indexKey] = {};
			}
			if(!result[indexBuilder.indexKey][element[indexBuilder.indexKey]]){
				result[indexBuilder.indexKey][element[indexBuilder.indexKey]] = [];
			}
			result[indexBuilder.indexKey][element[indexBuilder.indexKey]].push(key);
		});
	});
	debug('result >> %j', result);
	return result;
};

exports.find = function find (config) {
	const debug = debugFactory('node-http-cache:indexes:find');
	const indexKey = config.indexKey;
	const data = config.data;
	if(indexKey){					
		const indexValue = config.indexValue;
		const indexes = config.indexes;
		
		debug('indexKey >> %s', indexKey);
		debug('indexValue >> %s', indexValue);
		debug('indexes >> %j', indexes);
		
		const dataIndexes = indexes[indexKey][indexValue];
		
		debug('dataIndexes >> %j', dataIndexes);
		//debug('data >> %j', data);
		
		var result = [];
		_.forEach(dataIndexes, function (dataIndex) {
			debug('dataIndex >> %s', dataIndex);
			let indexData = data[dataIndex];
			debug('indexData >> %j', indexData);
			result.push(indexData);
		});
		return result;
	}
	debug(util.format('No index defined for retrieving %s',config.serviceName));
	return data;
};