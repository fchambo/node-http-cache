'use strict';

const cacheFactory = require('../index.js');
const http = require('http');
const debugFactory = require('debug');
const util = require('util');
const should = require('should');
const PORT = 8081;
const PORT2= 8083;
const USERS_SERVICE_NAME = 'users';
const CITIES_SERVICE_NAME= 'cities';
const cities = require('./cities');


process.on('uncaughtException',function errorHandler (err) {
	console.error(err.message);
});

function mockService (req, res) {
	const debug = debugFactory('node-http-cache:test:mockService');
	debug('req.headers >> %j', req.headers);
	debug('req.method >> %s', req.method);
	res.setHeader('Content-Type', 'application/json');
  res.end(
  	JSON.stringify([
  		{ user: 'barney', age: 36, active: true },
  		{ user: 'fred',   age: 40, active: false }
		])
	);
}
const server = http.createServer(mockService);
describe('users service', function () {
	this.timeout(5000);
	it('build snapshot', function buildSnapshot(done) {
		const debug = debugFactory('node-http-cache:test:buildSnapshot');
		server.listen(PORT,'localhost',function serverStarted (err) {
			if (err) {console.error(err.message);}
			console.log(util.format('Server started at http://localhost:%s',PORT));
			const config = {
				logger: require('winston'),
				location: process.env.TEST_LOCATION || '/tmp',
				services:[{
					cronExpression: '* * * * * *',
					name: USERS_SERVICE_NAME,
					timezone: 'America/Buenos_Aires',
					httpOptions:{
						url: util.format('http://localhost:%s',PORT)	,
						headers: {
							'accept':'application/json'
						}
					},
					indexes: ['user', 'active']
				}]
			};
			const cache = cacheFactory(config);
			cache.on('getData',function (data) {
				debug('getData event received >> %j',data);
			});
			cache.on('getError',function (err) {
				debug('getError event received >> %s',err.message);
			});
			cache.on('updateData',function (data) {
				//debug('updateData event received >> %j',data);
			});
			cache.on('updateError',function (err) {
				debug('updateError event received >> %s',err.message);
			});
			setTimeout(function () {
				cache.get({
					name: USERS_SERVICE_NAME, 
					indexKey: 'active',
					indexValue: true
				}).then(function (data) {
					should.exist(data);
					should.deepEqual(data,[{ 'user': 'barney', 'age': 36, 'active': true }]);
					cache.stop();
					server.close();
				})
				.then(done)
				.fail(done);
			},4000);
		});
	});
});

function mockCitiesService (req, res) {
	const debug = debugFactory('node-http-cache:test:mockService');
	debug('req.headers >> %j', req.headers);
	debug('req.method >> %s', req.method);
	res.setHeader('Content-Type', 'application/json');
  res.end(
  	JSON.stringify(cities)
	);
}
const server2 = http.createServer(mockCitiesService);
describe('cities service', function () {
	this.timeout(120000);
	it('build cities snapshot', function buildSnapshot(done) {
		const debugCities = debugFactory('node-http-cache:test:buildSnapshot');
		server2.listen(PORT2,'localhost',function serverStarted (err) {
			if (err) {console.error(err.message);}
			console.log(util.format('Server started at http://localhost:%s',PORT));
			const configCities = {
				logger: require('winston'),
				location: process.env.TEST_LOCATION || '/tmp',
				services:[{
					cronExpression: '0 0/10 * * * * *',
					name: CITIES_SERVICE_NAME,
					timezone: 'America/Buenos_Aires',
					httpOptions:{
						url: util.format('http://localhost:%s',PORT2)	,
						headers: {
							'accept':'application/json'
						}
					},
					indexes: ['id']
				}]
			};
			const cacheCities = cacheFactory(configCities);
			cacheCities.on('getData',function (data) {
				debugCities('getData event received >> %j',data);
			});
			cacheCities.on('getError',function (err) {
				debugCities('getError event received >> %s',err.message);
			});
			cacheCities.on('updateData',function (data) {
				//debug('updateData event received >> %j',data);
			});
			cacheCities.on('updateError',function (err) {
				debugCities('updateError event received >> %s',err.message);
			});
			setTimeout(function () {
				cacheCities.get({
					name: CITIES_SERVICE_NAME, 
					indexKey: 'id',
					indexValue: '1342108'
				}).then(function (data) {
					should.exist(data);
					//should.deepEqual(data,[{ 'user': 'barney', 'age': 36, 'active': true }]);
					cacheCities.stop();
					server2.close();
				})
				.then(done)
				.fail(done);
			},4000);
		});
	});
});
