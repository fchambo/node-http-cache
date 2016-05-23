[![Travis-CI](https://api.travis-ci.org/neuquino/node-http-cache.svg?branch=master)](https://travis-ci.org/neuquino/node-http-cache)

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
