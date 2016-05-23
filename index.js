'use strict';

var debugFactory = require('debug');
var Q = require('q');
var http = require('q-io/http');
var util = require('util');
var _ = require('lodash');
var zlib = require('zlib');
var CronJob = require('cron').CronJob;
var level = require('level');
const assert = require('assert');

module.exports = function factory (config) {
	var db;

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
		var debug = debugFactory('node-http-cache:downloadData');
		return http.request(service.httpOptions)
		.then(
			function (response) {
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
			}
		).fail(function error(err) {
			debug('error >> %j',err);
			console.error(err.message);
			throw err;
		});
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
							debug('error >> %s', err.message);
							deferred.reject(err.message);
						}else{
							deferred.resolve(response.body);
						}
					});
					return deferred.promise;
					//return Q.nfcall(db.put,service.name,response.body);
				}
			).fail(function (err) {
				debug('error >> %s >> %s',err.message, err.stack);
				throw err;
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
		var dbFilename = config.location + '/node-http-cache.db';
		db = level(dbFilename);
		_.forEach(config.services,function (service) {
			debug('Scheduling service "%s" with expression "%s"', service.name, service.cronExpression);
			new CronJob({
				cronTime: service.cronExpression, 
				onTick: updateService(service), 
				onComplete: serviceUpdated(service),
				start: true,
				timeZone: service.timezone || config.timezone || 'GMT-0'
			});
		});
		debug('db >> %j',db);
		return {};
	}

	var debug = debugFactory('node-http-cache:factory');

	var _config = buildConfig(config);

	debug('_config >> %j', _config);
	var NodeHttpCache = init(_config);

	NodeHttpCache.get = function (serviceName,filters) {
		var debug = debugFactory('node-http-cache:get');
		debug ('db >> %j', db);
		var deferred = Q.defer();
		db.get(serviceName, function callback (err, data) {
			if(err){
				debug('error >> %s',err.message);
				deferred.reject(err);
			}else{
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
		)
		.then(
			function debugLog(data){
				debug('%s >> %j', serviceName,data);
				return data;
			}
		).fail(function (err) {
			debug('error >> %s', err.message);
		});
	};

	return NodeHttpCache;
};