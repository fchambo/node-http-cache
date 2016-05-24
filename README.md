[![Travis-CI](https://api.travis-ci.org/neuquino/node-http-cache.svg?branch=master)](https://travis-ci.org/neuquino/node-http-cache) [![GitHub issues](https://img.shields.io/github/issues/neuquino/node-http-cache.svg?style=plastic)](https://github.com/neuquino/node-http-cache/issues) [![GitHub license](https://img.shields.io/badge/license-Apache_2.0-blue.svg?style=plastic)](https://raw.githubusercontent.com/neuquino/node-http-cache/master/LICENSE) [![Node JS version](https://img.shields.io/node/v/neuquino/node-http-cache.svg?style=plastic)](https://nodejs.org/en/) [![npm downloads](https://img.shields.io/npm/dt/neuquino/node-http-cache.svg?style=plastic)](https://www.npmjs.com/package/node-http-cache)

#HTTP Cache

>This module uses a simple filesystem storage ([levelup](https://www.npmjs.com/package/levelup)) to persist http responses. Storage is updated using cron expressions (see [crontab manpage](http://crontab.org/) for more detail on how to build these expressions).

---


##Usage

```javascript
var cacheFactory = require('node-http-cache');

// (...)

var config = {
  //Any logger with the following defined functions: error, warn, info, debug.
	logger: require('winston'),
	//Folder where the storage will be created.
	location: '/tmp',
	//List of services
	services:[{
		//Update every day at 00:00
		cronExpression: '0 0 * * *',
		name: 'cities',
		timezone: 'America/Buenos_Aires',
		httpOptions:{
			url: 'http://api.geonames.org/citiesJSON?north=44.1&south=-9.9&east=-22.4&west=55.2&lang=de&username=demo',
			headers: {
				'accept':'application/json'
			}
		}
	}]
};

// (...)

var cache = cacheFactory(config);

// (...)

var allCities = cache.get('cities');
var onlyMXCities = cache.get('cities', {countrycode: 'MX'}); 
```

## Configuration

### location

*Required*: `true`

Root folder for levelup storage.

### logger

*Required*: `true`	

Any logger can be used here. The only requirement is to have this functions defined: `error`, `warn`, `info`, `debug`.

### services.name

*Required*: `true`

Service identifier, this name **MUST BE UNIQUE** among all services.

### services.cronExpression

*Required*: `true`

Use [crontab expressions](http://crontab.org/) to specify when the snapshot should be updated. 

### services.httpOptions

*Required*: `true`

Node HTTP Cache uses [q-io](https://github.com/kriskowal/q-io) internally to make the requests. You can set any option specified in [its docs](https://github.com/kriskowal/q-io#request). Only `service.httpOptions.url` is required.

### services.timezone 

*Required*: `false`

*Default*: `'GMT-0'`

## Retrieve data

### get(serviceName)

Retrieves data saved to the service which name is equal to `serviceName`.

Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)


## Events

### getData

Once data is retrieved from the filesystem storage.

```javascript
{
  //Name of service retrieved
  name: String,
  //Data retrieved
  data: Object
}
```

### getError

Error retrieving data from the filesystem storage. The returning value is an instance of [Error](https://nodejs.org/dist/latest-v4.x/docs/api/errors.html#errors_class_error)

### updateData

Once data is updated to the filesystem storage.

```javascript
{
  //Name of service retrieved
  name: String,
  //Data retrieved
  data: Object
}
```

### updateError

Error updating data for service. The returning value is an instance of [Error](https://nodejs.org/dist/latest-v4.x/docs/api/errors.html#errors_class_error)
