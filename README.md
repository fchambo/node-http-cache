[![Build Status](https://secure.travis-ci.org/neuquino/node-http-cache.svg?branch=master)](http://travis-ci.org/neuquino/node-http-cache)
[![Build Status](https://david-dm.org/neuquino/node-http-cache.svg)](https://david-dm.org/neuquino/node-http-cache.svg)
[![NPM version](https://badge.fury.io/js/node-http-cache.svg)](http://badge.fury.io/js/node-http-cache)

[![Gitter](https://badges.gitter.im/node-http-cache/Lobby.svg)](https://gitter.im/node-http-cache/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

[![NPM](https://nodei.co/npm/node-http-cache.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/node-http-cache/)


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
			url: 'http://api.geonames.org/citiesJSON?north=44.1&south=-9.9&east=-22.4&west=55.2&lang=de&username=demoapp',
			headers: {
				'accept':'application/json'
			}
		},
		indexes: ['countrycode']
	}]
};

// (...)

var cache = cacheFactory(config);

// (...)

// Retrieves all cities
var allCities = cache.get(
  {
    name: 'cities'
  }
);
var onlyMXCities = cache.get(
  {
	  name: 'cities', 
	  indexKey: 'countrycode',
	  indexValue: 'MX'
); 
```

## Configuration

### location

*Required*: `true`

Root folder for levelup storage. Inside this directory a folder with the name `node-http-cache.db` will be created. 

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

### services.itemsPath

*Required*: `false`

Path to specify where is the array of objects to store. For example, if the response of the service is: `{items:[]}`, then `itemsPath: 'items'`. To specify nested elements, you can use dot notation (i.e.: `itemsPath: 'root.items'`)

### services.indexes

*Required*: `false`

Array of fields to be indexed. For example, if the response of the service is `[{ "user": "barney", "age": 36, "active": true},{ "user": "fred",   "age": 40, "active": false }]`, then you can create an index by user using `indexes: ["user"]`

## Retrieve data

### get(config)

Retrieves data saved using the config received as parameter.

Returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)

#### config.name

*Required*: true

Name used in config when the snapshot was created.

#### config.indexKey

*Required*: false

Name of the index used to search.

#### config.indexValue

*Required: false

If you specify an indexKey you *MUST* specify an indexValue.


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
  //Name of service updated
  name: String,
  //Data retrieved
  data: Object
}
```

### updateError

Error updating data for service. The returning value is an instance of [Error](https://nodejs.org/dist/latest-v4.x/docs/api/errors.html#errors_class_error)

## TO DO

- Partial Updates
- ~~In memory storage~~
- ~~Indexes~~