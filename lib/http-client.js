'use strict';

const http = require('http');
const Q = require('q');
const debugFactory = require('debug');
const zlib = require('zlib');
const url = require('url');
const util = require('util');
const _ = require('lodash');

exports.downloadData = function (options) {
	var debug = debugFactory('node-http-cache:http-client:downloadData');
	var deferred = Q.defer();
	if(!options.headers){
		options.headers = {};
	} 
	if(!options.headers['user-agent']){
		options.headers['user-agent'] = 'curl/7.49.1';
	}
	if(options.url){
		let parsedUrl = url.parse(options.url);
		options = _.merge(options,parsedUrl);
	}
	debug('options >> %j', options);
	var req = http.request(options,
		function (res) {
			debug('response.status >> %s',res.statusCode);
			debug('response.headers >> %j', res.headers);
			var body = '';
			function appendBody(chunk) {
				body += chunk.toString();
			}
			function endRead () {
				debug('all data received');
				body = JSON.parse(body);
				deferred.resolve({
					status: res.statusCode,
					headers: res.headers,
					body: body
				});
			}
			function handleError(err) {
				debug('error >> %s',err.stack);
				deferred.reject(err);
			}
			if(res.statusCode >= 200 && res.statusCode < 400){
				if(res.headers['content-encoding'] === 'gzip'){
					debug('gunzip');
					var gunzip = zlib.createGunzip();
					gunzip.on('data', appendBody);
					gunzip.on('end', endRead);
					gunzip.on('error', handleError);
					res.pipe(gunzip);
				}else{
					debug('raw data');
					res.on('data', appendBody);
					res.on('end', endRead);
					res.on('error', handleError);
				}
			}else{
				var statusDescription = http.STATUS_CODES[res.statusCode];
				debug('error > %s', statusDescription);
				throw new Error(util.format('%s >> %s', res.statusCode, statusDescription));
			}
		}
	);
	req.on('error', function (err) {
		debug('req error >> ', err.stack);
		deferred.reject(err);
	});
	req.end();
	return deferred.promise;
};
