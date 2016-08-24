'use strict';
const http = require('http');
const debugFactory = require('debug');
const should = require('should');
const PORT = 8081;
const PORT2= 8083;
const USERS_SERVICE_NAME = 'users';
const CITIES_SERVICE_NAME= 'cities';

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
function searchUsers (cache,done, server) {
	cache.get({
		name: USERS_SERVICE_NAME, 
		indexKey: 'active',
		indexValue: true
	}).then(function (data) {
		should.exist(data);
		should.deepEqual(data,[{ 'user': 'barney', 'age': 36, 'active': true }]);
	})
	.then(done)
	.fail(done)
	.finally(
		function (){
			cache.stop();
			server.close();
		}
	);
}
const server = http.createServer(mockService);
describe('users service', function () {
	this.timeout(5000);
	it('build snapshot', function buildSnapshot(done) {
		const cacheFactory = require('../index.js');
		const debug = debugFactory('node-http-cache:test:buildSnapshot');
		server.listen(PORT,'localhost',function serverStarted (err) {
			if (err) {
				server.close();
				console.error(err.message);
				return done(err);
			}
			debug('Server started at http://localhost:%s',PORT);
			const config = {
				logger: require('winston'),
				location: process.env.TEST_LOCATION || '/tmp',
				services:[{
					cronExpression: '0 0/10 * * * *',
					name: USERS_SERVICE_NAME,
					timezone: 'America/Buenos_Aires',
					httpOptions:{
						protocol: 'http:',
						hostname: 'localhost',
						port: PORT,
						method: 'GET',
						path: '/',
						headers: {
							'accept':'application/json'
						}
					},
					indexes: ['user', 'active']
				}]
			};
			const cache = cacheFactory(config);
			const timeoutId = setTimeout(function () {
				searchUsers(cache,done,server);
			},3000);
			cache.on('getData',function (data) {
				debug('getData event received >> %j',data);
			});
			cache.on('getError',function (err) {
				debug('getError event received >> %s',err.message);
			});
			cache.on('updateData',function () {
				//debug('updateData event received >> %j',data);
				clearTimeout(timeoutId);
				searchUsers(cache, done, server);
			});
			cache.on('updateError',function (err) {
				debug('updateError event received >> %s',err.message);
			});
		});
	});
});

function mockCitiesService (req, res) {
	const debug = debugFactory('node-http-cache:test:mockService');
	debug('req.headers >> %j', req.headers);
	debug('req.method >> %s', req.method);
	var cities = require('./cities');
	res.setHeader('Content-Type', 'application/json');
  res.end(
  	JSON.stringify(cities)
	);
}

function searchCities (cacheCities, done, server2) {
	cacheCities.get({
		name: CITIES_SERVICE_NAME, 
		indexKey: 'id',
		indexValue: '4451'
	}).then(function (data) {
		should.exist(data);
		//should.deepEqual(data,[{ 'user': 'barney', 'age': 36, 'active': true }]);
	})
	.then(done)
	.fail(done)
	.finally(
		function () {
			cacheCities.stop();
			server2.close();
		}
	);
}
const server2 = http.createServer(mockCitiesService);
describe('cities service', function () {
	this.timeout(200000);
	it('build cities snapshot', function buildSnapshot(done) {
		const cacheFactory = require('../index.js');
		const debugCities = debugFactory('node-http-cache:test:buildSnapshot');
		server2.listen(PORT2,'localhost',function serverStarted (err) {
			if (err) {
				server2.close();
				console.error(err.message);
				return done(err);
			}
			debugCities('Server started at http://localhost:%s',PORT);
			const configCities = {
				logger: require('winston'),
				location: process.env.TEST_LOCATION || '/tmp',
				services:[{
					cronExpression: '0 0 * * * *',
					name: CITIES_SERVICE_NAME,
					timezone: 'America/Buenos_Aires',
					httpOptions:{
						protocol: 'http:',
						hostname: 'localhost',
						port: PORT2,
						method: 'GET',
						path: '/',
						headers: {
							'accept':'application/json'
						}
					},
					indexes: ['id']
				}]
			};
			debugCities('creating cacheFactory');
			const cacheCities = cacheFactory(configCities);
			const timeoutId = setTimeout(function () {
				clearTimeout(timeoutId);
				searchCities(cacheCities,done,server2);
			},30000);
			debugCities('cacheFactory created.');
			cacheCities.on('getData',function (data) {
				debugCities('getData event received >> %j',data);
				console.error('getData event received');
			});
			cacheCities.on('getError',function (err) {
				debugCities('getError event received >> %s',err.message);
				console.error('getError event received');
			});
			cacheCities.on('updateData',function () {
				debugCities('updateData event received');
				console.log('updateData event received');
				searchCities(cacheCities,done,server2);
			});
			cacheCities.on('updateError',function (err) {
				debugCities('updateError event received >> %s',err.message);
				console.error('updateError event received');
			});
		});
	});
});
