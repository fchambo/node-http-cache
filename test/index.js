'use strict';

var cacheFactory = require('../index.js');
var http = require('http');
var debugFactory = require('debug');
var util = require('util');
var should = require('should');
const PORT = 8080;
const SERVICE_NAME = 'users';


process.on('uncaughtException',function errorHandler (err) {
	console.error(err.message);
});

function mockService (req, res) {
	var debug = debugFactory('test:mockService');
	debug('req.headers >> %j', req.headers);
	debug('req.method >> %s', req.method);
	res.setHeader('Content-Type', 'application/json');
  res.end(
  	JSON.stringify([
  		{ 'user': 'barney', 'age': 36, 'active': true },
  		{ 'user': 'fred',   'age': 40, 'active': false }
		])
	);
}
var server = http.createServer(mockService);
describe('users service', function () {
	this.timeout(5000);
	it('build snapshot', function (done) {
		server.listen(PORT,'localhost',function serverStarted (err) {
			if (err) {console.error(err.message);}
			console.log(util.format('Server started at http//localhost:%s',PORT));
			var config = {
				logger: require('winston'),
				location: process.env.TEST_LOCATION || '/tmp',
				services:[{
					cronExpression: '* * * * *',
					name: SERVICE_NAME,
					timezone: 'America/Buenos_Aires',
					httpOptions:{
						url: 'http://localhost:8080',
						headers: {
							'accept':'application/json'
						}
					}
				}]
			};
			var cache = cacheFactory(config);
			setTimeout(function () {
				cache.get(SERVICE_NAME, 
						{active: true}
					)
				.then(function (data) {
					should.exist(data);
					should.deepEqual(data,[{ 'user': 'barney', 'age': 36, 'active': true }]);
				})
				.then(done)
				.fail(done);
			},2000);
		});
	});
});
