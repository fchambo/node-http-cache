'use strict';

const debugFactory = require('debug');
const Q = require('q');
const http = require('q-io/http');
const util = require('util');
const _ = require('lodash');
const zlib = require('zlib');
const CronJob = require('cron').CronJob;
const storage = require('./lib/storage');
const EventEmitter = require('events').EventEmitter;
const assert = require('assert');
const Index = require('./lib/indexes');

var instance;

module.exports = function factory (config) {
	if (instance){
		return instance;
	}

	var self;

	function buildConfig (config) {
		const debug = debugFactory('node-http-cache:buildConfig');
		debug('config >> %j', config);
		const _config = {
			location: config.location || '/tmp'
		};
		_config.services=[];
		_.forEach(config.services,function (service, key) {
			assert(service.name, util.format('services[%s].name must be defined', key));
			assert(service.cronExpression, util.format('service[%s].cronExpression must be defined', key));
			assert(service.httpOptions, util.format('service[%s].httpOptions.url must be defined', key));
			assert(service.httpOptions.url, util.format('service[%s].httpOptions.url must be defined', key));
			_config.services.push({
				name: service.name,
				cronExpression: service.cronExpression,
				itemsPath: service.itemsPath,
				indexes: service.indexes,
				httpOptions: service.httpOptions
			});
		});
		return _config;
	}


	function downloadData(service) {
		return http.request(service.httpOptions)
		.then(
			function (response) {
				if(response.status >= 200 && response.status < 400){
					return response.body.read()
					.then(
						function (body) {
							const encoding = response.headers['content-encoding'];
	            switch (encoding) {
		            case 'gzip':
		              return Q.nfcall(zlib.gunzip(body))
		              .then(
		              	function buildResponse (body) {
		              		return {
		              			body: JSON.parse(body.toString()),
		              			headers: response.headers,
		              			status: response.status
		              		};
		              	}
		              );
		            default:
	                return {
	                  body: JSON.parse(body.toString()),
	                  headers: response.headers,
	                  status: response.status
	                };
		          }
						}
					);
				}else{
					const statusDescription = require('http').STATUS_CODES[response.status];
					throw new Error(util.format('%s >> %s', response.status, statusDescription));
				}
			}
		);
	}

	function updateService (service) {
		return function (){
			const debug = debugFactory('node-http-cache:updateService');
			debug('Updating service "%s"...',service.name);
			return downloadData(service)
			.then(
				function indexes (response) {
					const indexes = Index.build({
						data: response.body,
						itemsPath: service.itemsPath,
						indexes: service.indexes
					});
					return {
						body: response.body,
						headers: response.headers,
						indexes: indexes
					};
				}
			).then(
				function buildObject (response) {
					return {
						config: service,
						data: response.body,
						headers: response.headers,
						indexes: response.indexes
					};
				}
			).then(
				function saveToStorage (object){
					debug('Saving to DB "%s" >> %j',object.config.name,object);
					let promises = [];
					promises.push(storage.put(object.config.name,object));
					return Q.all(promises)
					.then(
						function emitEvent(results) {
							debug('results >> %j', results);
							_.forEach(results, function (object) {
								debug('object >> %j', object);
								self.emit('updateData',{name:object.config.name,data:object.data});
							});
						}
					);
				}
			).fail(function (err) {
				debug('error >> %s >> %s',service.name, err.stack);
				const error = new Error(util.format('%s >> %s',service.name,err.stack));
				self.emit('updateError',error);
				throw error;
			});
		};
	}

	function serviceUpdated (service) {
		const debug = debugFactory('node-http-cache:serviceUpdated');
		return function () {
			debug('Service "%s" updated.',service.name);
		};
	}

	function init (config) {
		const debug = debugFactory('node-http-cache:init');
		debug('config >> %j',config);
		storage.init(config);
		_.forEach(config.services,function (service) {
			debug('Scheduling service "%s" with expression "%s"', service.name, service.cronExpression);
			debug('Checking if snapshot for "%s" already exists', service.name);
			storage.get(service.name)
			.then(
				function callback() {
					return false;
				},
				function error(){
					return true;
				}
			).then(
				function startCron (runOnInit) {
					new CronJob({
						cronTime: service.cronExpression, 
						onTick: updateService(service), 
						onComplete: serviceUpdated(service),
						start: true,
						timeZone: service.timezone || config.timezone || 'GMT-0',
						runOnInit: runOnInit
					});
				}
			);
		});
		return function () {
			EventEmitter.call(this);
			self = this;
		};
	}

	const debug = debugFactory('node-http-cache:factory');

	const _config = buildConfig(config);

	debug('_config >> %j', _config);
	const NodeHttpCache = init(_config);

	util.inherits(NodeHttpCache,EventEmitter);

	NodeHttpCache.prototype.get = function (config) {
		const serviceName = config.name;
		const indexKey = config.indexKey;
		const debug = debugFactory('node-http-cache:get');
		debug('serviceName >> %s', serviceName);
		debug('indexKey >> %s', indexKey);
		return storage.get(serviceName)
		.then(
			function findIndex (object) {
				if(indexKey){					
					const indexes = object.indexes;
					const indexValue = config.indexValue;
					return Index.find({
						indexes: indexes,
						indexKey: indexKey,
						indexValue: indexValue,
						data: object.data
					});
				}
				debug(util.format('No index defined for retrieving %s',serviceName));
				return object.data;
			}
		).then(
			function debugLog(data){
				debug('%s >> %j', serviceName,data);
				self.emit('getData',{
					name: serviceName,
					data: data
				});
				return data;
			}
		).fail(function (err) {
			debug('error >> %s >> %s', err.message, err.stack);
			const error = new Error(util.format('%s >> %s',serviceName,err.stack));
			self.emit('getError', error);
			throw error;
		});
	};

	instance = new NodeHttpCache();

	return instance;
};