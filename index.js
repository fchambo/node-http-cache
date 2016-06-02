'use strict';

var debugFactory = require('debug');
var Q = require('q');
var http = require('q-io/http');
var util = require('util');
var _ = require('lodash');
var zlib = require('zlib');
var CronJob = require('cron').CronJob;
var level = require('level');
var EventEmitter = require('events').EventEmitter;
const assert = require('assert');

var instance;

module.exports = function factory (config) {
	if (instance){
		return instance;
	}

	var db;
	var self;

	function buildConfig (config) {
		var debug = debugFactory('node-http-cache:buildConfig');
		debug('config >> %j', config);
		var _config = {
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
							var encoding = response.headers['content-encoding'];
	            switch (encoding) {
		            case 'gzip':
		              return Q.nfcall(zlib.gunzip(body))
		              .then(
		              	function buildResponse (body) {
		              		return {
		              			body: body.toString(),
		              			headers: response.headers,
		              			status: response.status
		              		};
		              	}
		              );
		            default:
	                return {
	                  body: body.toString(),
	                  headers: response.headers,
	                  status: response.status
	                };
		          }
						}
					);
				}else{
					var statusDescription = require('http').STATUS_CODES[response.status];
					throw new Error(util.format('%s >> %s', response.status, statusDescription));
				}
			}
		);
	}

	function updateService (service) {
		return function (){
			var debug = debugFactory('node-http-cache:updateService');
			debug('Updating service "%s"...',service.name);
			return downloadData(service)
			.then(
				function saveToDb (response){
					debug('Saving to DB "%s" >> %j',service.name,response.body);
					var deferred = Q.defer();
					db.put(service.name,response.body,function callback(err) {
						if (err){
							return deferred.reject(err);
						}else{
							debug('updateData >> %j', response.body);
							self.emit('updateData',{name:service.name,data:response.body});
							deferred.resolve(response.body);
						}
					});
					return deferred.promise;
				}
			).fail(function (err) {
				debug('error >> %s >> %s',err.message, err.stack);
				var error = err;
				error.name = service.name;
				self.emit('updateError',error);
				throw error;
			});
		};
	}

	function serviceUpdated (service) {
		var debug = debugFactory('node-http-cache:serviceUpdated');
		return function () {
			debug('Service "%s" updated.',service.name);
		};
	}

	function init (config) {
		var debug = debugFactory('node-http-cache:init');
		debug('config >> %j',config);
		var dbLocation = config.location + '/node-http-cache.db';
		db = level(dbLocation);
		_.forEach(config.services,function (service) {
			debug('Scheduling service "%s" with expression "%s"', service.name, service.cronExpression);
			debug('Checking if snapshot for "%s" already exists', service.name);
			db.get(service.name,function callback(err) {
				var runOnInit = false;
				if(err) {runOnInit = true;}
				new CronJob({
					cronTime: service.cronExpression, 
					onTick: updateService(service), 
					onComplete: serviceUpdated(service),
					start: true,
					timeZone: service.timezone || config.timezone || 'GMT-0',
					runOnInit: runOnInit
				});
			});
		});
		return function () {
			EventEmitter.call(this);
			self = this;
		};
	}

	var debug = debugFactory('node-http-cache:factory');

	var _config = buildConfig(config);

	debug('_config >> %j', _config);
	var NodeHttpCache = init(_config);

	util.inherits(NodeHttpCache,EventEmitter);

	NodeHttpCache.prototype.get = function (serviceName,filters) {
		var debug = debugFactory('node-http-cache:get');
		debug ('db >> %j', db);
		var deferred = Q.defer();
		db.get(serviceName, function callback (err, data) {
			if(err){
				deferred.reject(err);
			}else{
				debug('data >> %s', data);
				deferred.resolve(JSON.parse(data));
			}
		});
		return deferred.promise	
		.then(
			function applyFilters (data){
				debug ('data >> %j', data);
				debug('filters >> %j', filters);	
				return filters ? _.filter(data, _.matches(filters)) : data;
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
			debug('error >> %s', err.message);
			var error = err;
			error.name = serviceName;
			self.emit('getError', error);
			throw error;
		});
	};

	instance = new NodeHttpCache();

	return instance;
};