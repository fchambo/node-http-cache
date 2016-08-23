'use strict';

const debugFactory = require('debug');
const httpClient = require('./lib/http-client');
const util = require('util');
const _ = require('lodash');
const CronJob = require('cron').CronJob;
const storage = require('./lib/storage');
const EventEmitter = require('events').EventEmitter;
const assert = require('assert');
const Index = require('./lib/indexes');
const cronJobs = [];

var instance;

module.exports = function factory (config) {
	/*if (instance){
		return instance;
	}*/

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
			assert(service.httpOptions, util.format('service[%s].httpOptions must be defined', key));
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


	function updateService (service) {
		return function (){
			const debug = debugFactory('node-http-cache:updateService:' + service.name);
			debug('Updating service...');
			return httpClient.downloadData(service.httpOptions)
			.then(
				function indexes (response) {
					const body = service.itemsPath ? response.body[service.itemsPath] : response.body;
					if(service.indexes){
						return Index.build({
							name: service.name,
							data: body,
							indexes: service.indexes
						}).
						then(function () {
							return {
								config: service,
								body: body,
								headers: response.headers
							};
						});
					}
					return {
						config: service,
						body: body,
						headers: response.headers
					};
				}
			).then(
				function saveToStorage (object){
					debug('Saving to DB "%s"',object.config.name);
					return storage.put(object.config.name,object)
					.then(
						function emitEvent(savedObject) {
							self.emit('updateData',{name:savedObject.config.name,data:savedObject.body});
						}
					);
				}
			).fail(function (err) {
				debug('error >> %s >> %s',service.name, err.stack);
				var error = new Error(util.format('%s >> %s',service.name,err.stack));
				self.emit('updateError',error);
				throw error;
			});
		};
	}

	function serviceUpdated (service) {
		var debug = debugFactory('node-http-cache:serviceUpdated:' + service.name);
		return function () {
			debug('Service updated.');
		};
	}

	function exists (key) {
		return storage.getKeys()
		.then(
			function (keys) {
				var foundKey = _.find(keys,function (storageKey) {
					return storageKey === key;
				});
				debug('foundKey >> %j', typeof foundKey);
				return typeof foundKey !== 'undefined';
			}
		);
	}

	function init (config) {
		var debug = debugFactory('node-http-cache:init');
		debug('config >> %j',config);
		storage.init(config);
		_.forEach(config.services,function (service) {
			debug('Scheduling service "%s" with expression "%s"', service.name, service.cronExpression);
			debug('Checking if snapshot for "%s" already exists', service.name);
			exists(service.name)
			.then(
				function callback(exists) {
					debug('exists >> %j',exists);
					return !exists;
				},
				function error(){
					return true;
				}
			).then(
				function startCron (runOnInit) {
					debug('runOnInit >> %s', runOnInit);
					cronJobs.push(new CronJob({
						cronTime: service.cronExpression, 
						onTick: updateService(service), 
						onComplete: serviceUpdated(service),
						start: true,
						timeZone: service.timezone || config.timezone || 'GMT-0',
						runOnInit: runOnInit
					}));
				}
			);
		});
		return function () {
			EventEmitter.call(this);
			self = this;
		};
	}

	function stop(){
		_.forEach(cronJobs, function (cron) {
			cron.stop();
		});
		storage.close();
	}

	const debug = debugFactory('node-http-cache:factory');

	const _config = buildConfig(config);

	debug('_config >> %j', _config);
	const NodeHttpCache = init(_config);

	util.inherits(NodeHttpCache,EventEmitter);

	NodeHttpCache.prototype.get = function (config) {
		const serviceName = config.name;
		const indexKey = config.indexKey;
		const debug = debugFactory('node-http-cache:get:' + serviceName);
		const indexValue = config.indexValue;
		debug('indexKey >> %s', indexKey);
		var storageKey = serviceName;
		if(indexKey && indexValue){
			storageKey = util.format('%s_%s_%s',serviceName,indexKey,indexValue);
		}
		debug('storageKey >> %j',storageKey);
		return storage.get(storageKey)
		.then(
			function debugLog(data){
				//debug('%s >> %j', serviceName,data);
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

	NodeHttpCache.prototype.exists = exists;

	NodeHttpCache.prototype.stop = function() {
		stop();
	};
	
	instance = new NodeHttpCache();
	
	return instance;
	
};
