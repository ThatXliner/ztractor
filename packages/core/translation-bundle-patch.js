// === translators.js ===
/**
 * Singleton to handle loading and caching of translators
 * This is a virtual class for reference implementation purposes
 * A consumer of the translation code should implement these functions
 */
Zotero.Translators = new function() {
	// Should be populated on this.init()
	this._cache = {"import":[], "export":[], "web":[], "search":[]};
	// Should set to true after translators are loaded into memory
	this._initialized = false;
	// TODO for tomorrow (ThatXliner, 2025-12-20): change this init code to be
	// adapted to how we have the registry
	/**
	 * Initializes translator cache, loading all relevant translators into memory
		* The thing is, we could choose to use the web to load translators from Zotero's server
		* or we could bundle them
	 * @param {Zotero.Translate[]} [translators] List of translators. If not specified, it will be
	 *                                           retrieved from storage.
	 */
	this.init = async function() {
	// @MODIFIED
	// XXX: or use bundled?
		var translators = await Zotero.Repo.getAllTranslatorMetadata();

		this._cache = {"import":[], "export":[], "web":[], "search":[]};
		_translators = {};

		// Build caches
		for(var i=0; i<translators.length; i++) {
			try {
				var translator = new Zotero.Translator(translators[i]);
				_translators[translator.translatorID] = translator;

				for(var type in TRANSLATOR_TYPES) {
					if(translator.translatorType & TRANSLATOR_TYPES[type]) {
						this._cache[type].push(translator);
					}
				}
			} catch(e) {
				Zotero.logError(e);
				try {
					Zotero.logError("Could not load translator "+JSON.stringify(translators[i]));
				} catch(e) {}
			}
		}

		// Sort by priority
		var cmp = function (a, b) {
			if (a.priority > b.priority) {
				return 1;
			}
			else if (a.priority < b.priority) {
				return -1;
			}
		}
		for(var type in this._cache) {
			this._cache[type].sort(cmp);
		}
		this._initialized = true;
	}
	/**
	 * Gets the translator that corresponds to a given ID with code set
	 * @param {String} id The ID of the translator
	 */
	this.get = async function (id) {
	// @MODIFIED
    if (!this._initialized) await Zotero.Translators.init();
			var translator = _translators[id];
			if (!translator) {
				return false;
			}

			// only need to get code if it is of some use
			if (translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER
					&& !translator.hasOwnProperty("code")) {

				translator.code = await Zotero.Translators.getCodeForTranslator(translator);
				return translator;
			} else {
				return translator;
			}
	};

	/**
	 * Gets the translator code that corresponds to a given ID
	 * This function is only necessary if translators are not loaded with
	 * code already during init(). If retrieving from repo you may want to
	 * cache updated translator info if metadata.lastUpdated > localTranslator.lastUpdated
	 *
	 * NOTE: This function should use the Zotero.Promise.method wrapper which adds a
	 * isResolved property to the returned promise for noWait translation.
	 *
	 * @param {Zotero.Translator} translator
	 * @return {String} translator code
	 */
	this.getCodeForTranslator = Zotero.Promise.method(async function (translator) {
	// @MODIFIED
	if (translator.code) return translator.code;
	let code = await Zotero.Repo.getTranslatorCode(translator.translatorID);
	translator.code = code;
	return code;
	});

	/**
	 * Gets all translators for a specific type of translation
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 */
	this.getAllForType = async function (type) {
	// @MODIFIED
	if(!this._initialized) await Zotero.Translators.init();
			var translators = this._cache[type].slice(0);
			var codeGetter = new Zotero.Translators.CodeGetter(translators);
			await codeGetter.getAll();
			return translators;
	};

	/**
	 * Gets web translators for a specific location
	 *
	 * @param {String} URI The URI where translation will run
	 * @param {String} rootURI The root URI of the page of translation if URI is a frame location
	 * @return {Promise<Array[]>} - A promise for a 2-item array containing an array of translators and
	 *     an array of functions for converting URLs from proper to proxied forms
	 */
	this.getWebTranslatorsForLocation = async function (URI, rootURI) {
		var isFrame = URI !== rootURI;
		if (!this._initialized) {
			if (this.init) {
				await this.init();
			}
			else {
				throw new Error('Zotero.Translators.getWebTranslatorsForLocation(): Zotero.Translators is not not initialized');
			}
		}
		var allTranslators = this._cache["web"];
		var potentialTranslators = [];
		var proxies = [];

		var rootSearchURIs = Zotero.Proxies.getPotentialProxies(rootURI);
		var frameSearchURIs = isFrame ? Zotero.Proxies.getPotentialProxies(URI) : rootSearchURIs;

		Zotero.debug("Translators: Looking for translators for "+Object.keys(frameSearchURIs).join(', '));

		for(var i=0; i<allTranslators.length; i++) {
			var translator = allTranslators[i];
			if (isFrame && !translator.webRegexp.all) {
				continue;
			}
			rootURIsLoop:
			for(var rootSearchURI in rootSearchURIs) {
				var isGeneric = !allTranslators[i].webRegexp.root;
				// don't attempt to use generic translators that can't be run in this browser
				// since that would require transmitting every page to Zotero host
				if(isGeneric && allTranslators[i].runMode !== Zotero.Translator.RUN_MODE_IN_BROWSER) {
					continue;
				}

				var rootURIMatches = isGeneric || rootSearchURI.length < 8192 && translator.webRegexp.root.test(rootSearchURI);
				if (translator.webRegexp.all && rootURIMatches) {
					for (var frameSearchURI in frameSearchURIs) {
						var frameURIMatches = frameSearchURI.length < 8192 && translator.webRegexp.all.test(frameSearchURI);

						if (frameURIMatches) {
							potentialTranslators.push(translator);
							proxies.push(frameSearchURIs[frameSearchURI]);
							// prevent adding the translator multiple times
							break rootURIsLoop;
						}
					}
				} else if(!isFrame && (isGeneric || rootURIMatches)) {
					potentialTranslators.push(translator);
					proxies.push(rootSearchURIs[rootSearchURI]);
					break;
				}
			}
		}

		let codeGetter = new Zotero.Translators.CodeGetter(potentialTranslators);
		await codeGetter.getAll();
		return [potentialTranslators, proxies];
	};
};


/**
 * A class to get the code for a set of translators at once
 *
 * @param {Zotero.Translator[]} translators Translators for which to retrieve code
 */
Zotero.Translators.CodeGetter = function(translators) {
	this._translators = translators;
	this._concurrency = 2;
};

Zotero.Translators.CodeGetter.prototype.getCodeFor = async function(i) {
	let translator = this._translators[i];
	try {
		translator.code = await Zotero.Translators.getCodeForTranslator(translator);
	} catch (e) {
		Zotero.debug(`Failed to retrieve code for ${translator.translatorID}`)
	}
	return translator.code;
};

Zotero.Translators.CodeGetter.prototype.getAll = async function () {
	let codes = [];
	// Chain promises with some level of concurrency. If unchained, fires
	// off hundreds of xhttprequests on connectors and crashes the extension
	for (let i = 0; i < this._translators.length; i++) {
		if (i < this._concurrency) {
			codes.push(this.getCodeFor(i));
		} else {
			codes.push(codes[i-this._concurrency].then(() => this.getCodeFor(i)));
		}
	}
	return Promise.all(codes);
};

// === http.js ===

/**
 * Functions for performing HTTP requests, both via XMLHTTPRequest and using a hidden browser
 * @namespace
 */
Zotero.HTTP = new function() {
	this.StatusError = function(xmlhttp, url) {
		this.message = `HTTP request to ${url} rejected with status ${xmlhttp.status}`;
		this.status = xmlhttp.status;
		try {
			this.responseText = typeof xmlhttp.responseText == 'string' ? xmlhttp.responseText : undefined;
		} catch (e) {}
	};
	this.StatusError.prototype = Object.create(Error.prototype);

	this.TimeoutError = function(ms) {
		this.message = `HTTP request has timed out after ${ms}ms`;
	};
	this.TimeoutError.prototype = Object.create(Error.prototype);

	/**
	 * Get a promise for a HTTP request
	 *
	 * @param {String} method The method of the request ("GET", "POST", "HEAD", or "OPTIONS")
	 * @param {String}	url				URL to request
	 * @param {Object} [options] Options for HTTP request:<ul>
	 *         <li>body - The body of a POST request</li>
	 *         <li>headers - Object of HTTP headers to send with the request</li>
	 *         <li>debug - Log response text and status code</li>
	 *         <li>logBodyLength - Length of request body to log</li>
	 *         <li>timeout - Request timeout specified in milliseconds [default 15000]</li>
	 *         <li>responseType - The response type of the request from the XHR spec</li>
	 *         <li>responseCharset - The charset the response should be interpreted as</li>
	 *         <li>successCodes - HTTP status codes that are considered successful, or FALSE to allow all</li>
	 *     </ul>
	 * @return {Promise<XMLHttpRequest>} A promise resolved with the XMLHttpRequest object if the
	 *     request succeeds, or rejected if the browser is offline or a non-2XX status response
	 *     code is received (or a code not in options.successCodes if provided).
	 */
		this.request = async function(method, url, options = {}) {
  		// @MODIFIED
			// Default options
			options = Object.assign({
				body: null,
				headers: {},
				debug: false,
				logBodyLength: 1024,
				timeout: 15000,
				responseType: '',
				responseCharset: null,
				successCodes: null
			}, options);


			let logBody = '';
			if (['GET', 'HEAD'].includes(method)) {
				if (options.body != null) {
					throw new Error(`HTTP ${method} cannot have a request body (${options.body})`)
				}
			} else if(options.body) {
				options.body = typeof options.body == 'string' ? options.body : JSON.stringify(options.body);

				if (!options.headers) options.headers = {};
				if (!options.headers["Content-Type"]) {
					options.headers["Content-Type"] = "application/x-www-form-urlencoded";
				}
				else if (options.headers["Content-Type"] == 'multipart/form-data') {
					// Allow fetch to set Content-Type with boundary for multipart/form-data
					delete options.headers["Content-Type"];
				}

				logBody = `: ${options.body.substr(0, options.logBodyLength)}` +
						options.body.length > options.logBodyLength ? '...' : '';
				// TODO: make sure below does its job in every API call instance
				// Don't display password or session id in console
				logBody = logBody.replace(/password":"[^"]+/, 'password":"********');
				logBody = logBody.replace(/password=[^&]+/, 'password=********');
			}
			Zotero.debug(`HTTP ${method} ${url}${logBody}`);

			// Set up fetch options
			const fetchOptions = {
				method: method,
				headers: options.headers,
				body: options.body
			};

			// Create AbortController for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), options.timeout);
			fetchOptions.signal = controller.signal;

			try {
				const response = await fetch(url, fetchOptions);
				clearTimeout(timeoutId);

				// Create XMLHttpRequest-like object for compatibility
				const xmlhttp = {
					status: response.status,
					responseURL: response.url,
					responseType: options.responseType || '',
					responseText: '',
					response: null
				};

				// Handle different response types
				if (options.responseType === 'arraybuffer') {
					xmlhttp.response = await response.arrayBuffer();
				} else if (options.responseType === 'blob') {
					xmlhttp.response = await response.blob();
				} else if (options.responseType === 'json') {
					xmlhttp.response = await response.json();
				} else {
					// Default to text
					xmlhttp.responseText = await response.text();
					xmlhttp.response = xmlhttp.responseText;
				}

				if (options.debug) {
					if (xmlhttp.responseType == '' || xmlhttp.responseType == 'text') {
						Zotero.debug(`HTTP ${xmlhttp.status} response: ${xmlhttp.responseText}`);
					}
					else {
						Zotero.debug(`HTTP ${xmlhttp.status} response`);
					}
				}

				let invalidDefaultStatus = options.successCodes === null && !xmlhttp.responseURL.startsWith("file://") &&
					(xmlhttp.status < 200 || xmlhttp.status >= 300);
				let invalidStatus = Array.isArray(options.successCodes) && !options.successCodes.includes(xmlhttp.status);
				if (invalidDefaultStatus || invalidStatus) {
					throw new Zotero.HTTP.StatusError(xmlhttp, url);
				}
				return xmlhttp;

			} catch (error) {
				clearTimeout(timeoutId);

				if (error.name === 'AbortError') {
					const timeoutError = new Zotero.HTTP.TimeoutError(options.timeout);
					Zotero.logError(timeoutError);
					throw timeoutError;
				}

				// Create XMLHttpRequest-like object for fetch errors
				const xmlhttp = {
					status: 0,
					responseURL: url,
					responseText: error.message
				};

				throw new Zotero.HTTP.StatusError(xmlhttp, url);
			}
		};
		/**
		* Send an HTTP GET request via fetch
		*
		* @deprecated Use {@link Zotero.HTTP.request}
		* @param {String}			url				URL to request
		* @param {Function} 		onDone			Callback to be executed upon request completion
		* @param {String}			responseCharset
		* @param {N/A}				cookieSandbox	Not used in Connector
		* @param {Object}			headers			HTTP headers to include with the request
		* @return {Boolean} True if the request was sent, or false if the browser is offline
		*/
		this.doGet = function(url, onDone, responseCharset, cookieSandbox, headers) {
			Zotero.debug('Zotero.HTTP.doGet is deprecated. Use Zotero.HTTP.request');
			this.request('GET', url, {responseCharset, headers})
			.then(onDone, function(e) {
				onDone({status: e.status, responseText: e.responseText});
				throw (e);
			});
			return true;
		};

		/**
		* Send an HTTP POST request via fetch
		*
		* @deprecated Use {@link Zotero.HTTP.request}
		* @param {String}			url URL to request
		* @param {String|Object[]}	body Request body
		* @param {Function}			onDone Callback to be executed upon request completion
		* @param {String}			headers Request HTTP headers
		* @param {String}			responseCharset
		* @return {Boolean} True if the request was sent, or false if the browser is offline
		*/
		this.doPost = function(url, body, onDone, headers, responseCharset) {
			Zotero.debug('Zotero.HTTP.doPost is deprecated. Use Zotero.HTTP.request');
			this.request('POST', url, {body, responseCharset, headers})
			.then(onDone, function(e) {
				onDone({status: e.status, responseText: e.responseText});
				throw (e);
			});
			return true;
		};


	/**
	 * Adds a ES6 Proxied location attribute
	 * @param doc
	 * @param docUrl
	 */
	this.wrapDocument = function(doc, docURL) {
		let url = require('url');
		docURL = url.parse(docURL);
		docURL.toString = () => this.href;
		var wrappedDoc = new Proxy(doc, {
			get: function (t, prop) {
				if (prop === 'location') {
					return docURL;
				}
				else if (prop == 'evaluate') {
					// If you pass the document itself into doc.evaluate as the second argument
					// it fails, because it receives a proxy, which isn't of type `Node` for some reason.
					// Native code magic.
					return function() {
						if (arguments[1] == wrappedDoc) {
							arguments[1] = t;
						}
						return t.evaluate.apply(t, arguments)
					}
				}
				else {
					if (typeof t[prop] == 'function') {
						return t[prop].bind(t);
					}
					return t[prop];
				}
			}
		});
		return wrappedDoc;
	};


	/**
	 * Adds request handlers to the XMLHttpRequest and returns a promise that resolves when
	 * the request is complete. xmlhttp.send() still needs to be called, this just attaches the
	 * handler
	 *
	 * See {@link Zotero.HTTP.request} for parameters
	 * @private
	 */
	this._attachHandlers = function(url, xmlhttp, options) {
		var deferred = Zotero.Promise.defer();
		xmlhttp.onload = () => deferred.resolve(xmlhttp);
		xmlhttp.onerror = xmlhttp.onabort = function() {
			var e = new Zotero.HTTP.StatusError(xmlhttp, url);
			if (options.successCodes === false) {
				deferred.resolve(xmlhttp);
			} else {
				deferred.reject(e);
			}
		};
		xmlhttp.ontimeout = function() {
			var e = new Zotero.HTTP.TimeoutError(xmlhttp.timeout);
			Zotero.logError(e);
			deferred.reject(e);
		};
		return deferred.promise;
	};
}
// === translation/translate_item.js ===
/**
 * A class which will be passed the results of translation as Zotero items and collections.
 *
 * This is a virtual class for reference implementation purposes
 * A consumer of the translation code should implement these functions
 */
Zotero.Translate.ItemSaver = function(libraryID, attachmentMode, forceTagType) {};
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE = 0;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD = 1;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE = 2;

/**
 * Only used by import translators and can remain a no-OP
 * @param {Array} collections
 */
Zotero.Translate.ItemSaver.prototype.saveCollection = function(collections) {};

/**
 * Called by Zotero.Translate upon successful item translation
 * @param {Object[]} jsonItems - Items in Zotero.Item.toArray() format
 * @param {Function} [attachmentCallback] A callback that receives information about attachment
 *     save progress. The callback will be called as attachmentCallback(attachment, false, error)
 *     on failure or attachmentCallback(attachment, progressPercent) periodically during saving.
 * @param {Function} [itemsDoneCallback] A callback that is called once all top-level items are
 *     done saving with a list of items. Can include saved notes, but should exclude attachments.
 */
Zotero.Translate.ItemSaver.prototype.saveItems = async function (jsonItems, attachmentCallback, itemsDoneCallback) {
  // @MODIFIED
  this.items = (this.items || []).concat(jsonItems);
	return jsonItems
	// throw new Error(`Zotero.Translate.ItemSaver.prototype.saveItems: not implemented`);
};

// Used by export translators in Zotero
Zotero.Translate.ItemGetter = function() {
	this._itemsLeft = null;
	this._itemID = 1;
};

Zotero.Translate.ItemGetter.prototype = {
	get numItemsRemaining() {
		return this._itemsLeft.length
	},

	setItems: function(items) {
		this._itemsLeft = items;
		this.numItems = this._itemsLeft.length;
	},

	setCollection: function (collection, getChildCollections) {
		throw new Error(`Zotero.Translate.ItemGetter.prototype.setCollection: not implemented`);
	},

	/**
	 * NOTE: This function should use the Zotero.Promise.method wrapper which adds a
	 * isResolved property to the returned promise for noWait translation.
	 */
	setAll: Zotero.Promise.method(function (libraryID, getChildCollections) {
		throw new Error(`Zotero.Translate.ItemGetter.prototype.setAll: not implemented`);
	}),

	/**
	 * Retrieves the next available item
	 */
	nextItem: function() {
		if(!this._itemsLeft.length) return false;
		var item = this._itemsLeft.shift();
		if (this.legacy) {
			item = Zotero.Utilities.Item.itemToLegacyExportFormat(item);
		}
		if (!item.attachments) {
			item.attachments = [];
		}
		if (!item.notes) {
			item.notes = [];
		}

		// convert single field creators to format expected by export
		if(item.creators) {
			for(var i=0; i<item.creators.length; i++) {
				var creator = item.creators[i];
				if(creator.name) {
					creator.lastName = creator.name;
					creator.firstName = "";
					delete creator.name;
					creator.fieldMode = 1;
				}
			}
		}

		item.itemID = this._itemID++;
		return item;
	},

	nextCollection: function() {
		return false;
	}
}
////// PROXY //////

Zotero.Proxies = new function() {

	/**
	 * Check the url for potential proxies and deproxify, providing a schema to build
	 * a proxy object.
	 *
	 * @param url
	 * @returns {Object} Unproxied url to proxy object
	 */
	this.getPotentialProxies = function(url) {
		// make sure url has a trailing slash
		url = new URL(url).href;
		var urlToProxy = {};
		// If it's a known proxied URL just return it
		if (Zotero.Proxies.transparent) {
			for (var proxy of Zotero.Proxies.proxies) {
				if (proxy.regexp) {
					var m = proxy.regexp.exec(url);
					if (m) {
						let proper = proxy.toProper(m);
						urlToProxy[proper] = proxy.toJSON();
						return urlToProxy;
					}
				}
			}
		}
		urlToProxy[url] = null;

		// if there is a subdomain that is also a TLD, also test against URI with the domain
		// dropped after the TLD
		// (i.e., www.nature.com.mutex.gmu.edu => www.nature.com)
		var m = /^(https?:\/\/)([^\/]+)/i.exec(url);
		if (m) {
			// First, drop the 0- if it exists (this is an III invention)
			var host = m[2];
			if (host.substr(0, 2) === "0-") host = host.substr(2);
			var hostnameParts = [host.split(".")];
			if (m[1] == 'https://') {
				// try replacing hyphens with dots for https protocol
				// to account for EZProxy HttpsHypens mode
				hostnameParts.push(host.split('.'));
				hostnameParts[1].splice(0, 1, ...(hostnameParts[1][0].replace(/-/g, '.').split('.')));
			}

			for (let i=0; i < hostnameParts.length; i++) {
				let parts = hostnameParts[i];
				// If hostnameParts has two entries, then the second one is with replaced hyphens
				// skip the lowest level subdomain, domain and TLD
				for (let j=1; j<parts.length-2; j++) {
					// if a part matches a TLD, everything up to it is probably the true URL
					if (TLDS[parts[j].toLowerCase()]) {
						var properHost = parts.slice(0, j+1).join(".");
						// protocol + properHost + /path
						var properURL = m[1]+properHost+url.substr(m[0].length);
						// Accommodating URLS like https://kns-cnki-net-443.webvpn.fafu.edu.cn:880/
						// where the TLD part j==3, but j+1 is not the start of the proxy host
						// See https://forums.zotero.org/discussion/comment/407995/#Comment_407995
						let skippedParts = '';
						while (parts[j+1].match(/^[0-9]*$/)) {
							skippedParts += '-' + parts[j+1];
							j++;
						}
						var proxyHost = parts.slice(j+1).join('.');
						urlToProxy[properURL] = {scheme: `%h${skippedParts}.${proxyHost}/%p`};
					}
				}
			}
		}
		return urlToProxy;
	};

	/**
	 * Determines whether a host is blacklisted, i.e., whether we should refuse to save transparent
	 * proxy entries for this host. This is necessary because EZProxy offers to proxy all Google and
	 * Wikipedia subdomains, but in practice, this would get really annoying.
	 *
	 * @type Boolean
	 * @private
	 */
	this._isBlacklisted = function(host) {
		/**
		 * Regular expression patterns of hosts never to proxy
		 * @const
		 */
		const hostBlacklist = [
			/edu$/,
			/google\.com$/,
			/wikipedia\.org$/,
			/^[^.]*$/,
			/doubleclick\.net$/,
			/^eutils.ncbi.nlm.nih.gov$/
		];
		/**
		 * Regular expression patterns of hosts that should always be proxied, regardless of whether
		 * they're on the blacklist
		 * @const
		 */
		const hostWhitelist = [
			/^scholar\.google\.com$/,
			/^muse\.jhu\.edu$/,
			/^(www\.)?journals\.uchicago\.edu$/
		]

		for (var blackPattern of hostBlacklist) {
			if (blackPattern.test(host)) {
				for (var whitePattern of hostWhitelist) {
					if (whitePattern.test(host)) {
						return false;
					}
				}
				return true;
			}
		}
		return false;
	}
};

/**
 * Creates a Zotero.Proxy object from a DB row
 *
 * @constructor
 * @class A model for a http proxy server
 */
Zotero.Proxy = function (json={}) {
	this.id = json.id || Date.now();
	this.autoAssociate = json.autoAssociate == undefined ? true : !!json.autoAssociate;
	this.scheme = json.scheme;
	this.hosts = json.hosts || [];
	if (this.scheme) {
		// Loading from storage or new
		this.compileRegexp();
	}
};

/**
 * Convert the proxy to JSON compatible object
 * @returns {Object}
 */
Zotero.Proxy.prototype.toJSON = function() {
	if (!this.scheme) {
		throw Error('Cannot convert proxy to JSON - no scheme');
	}
	return {id: this.id, scheme: this.scheme};
};


/**
 * Regexps to match the URL contents corresponding to proxy scheme parameters
 * @const
 */
const Zotero_Proxy_schemeParameters = {
	"%p": "(.*?)",	// path
	"%d": "(.*?)",	// directory
	"%f": "(.*?)",	// filename
	"%a": "(.*?)",	// anything
	"%h": "([a-zA-Z0-9]+[.\\-][a-zA-Z0-9.\\-]+)"	// hostname
};

/**
 * Regexps to match proxy scheme parameters in the proxy scheme URL
 * @const
 */
const Zotero_Proxy_schemeParameterRegexps = {
	"%p": /([^%])%p/,
	"%d": /([^%])%d/,
	"%f": /([^%])%f/,
	"%h": /([^%])%h/,
	"%a": /([^%])%a/
};


/**
 * Compiles the regular expression against which we match URLs to determine if this proxy is in use
 * and saves it in this.regexp
 */
Zotero.Proxy.prototype.compileRegexp = function() {
	var indices = this.indices = {};
	this.parameters = [];
	for (var param in Zotero_Proxy_schemeParameters) {
		var index = this.scheme.indexOf(param);

		// avoid escaped matches
		while (this.scheme[index-1] && (this.scheme[index-1] == "%")) {
			this.scheme = this.scheme.substr(0, index-1)+this.scheme.substr(index);
			index = this.scheme.indexOf(param, index+1);
		}

		if (index != -1) {
			this.indices[param] = index;
			this.parameters.push(param);
		}
	}

	// sort params by index
	this.parameters = this.parameters.sort(function(a, b) {
		return indices[a]-indices[b];
	});

	// now replace with regexp fragment in reverse order
	var re;
	if (this.scheme.includes('://')) {
		re = "^"+Zotero.Utilities.quotemeta(this.scheme)+"$";
	} else {
		re = "^https?"+Zotero.Utilities.quotemeta('://'+this.scheme)+"$";
	}
	for(var i=this.parameters.length-1; i>=0; i--) {
		var param = this.parameters[i];
		re = re.replace(Zotero_Proxy_schemeParameterRegexps[param], "$1"+Zotero_Proxy_schemeParameters[param]);
	}

	this.regexp = new RegExp(re);
}

/**
 * Converts a proxied URL to an unproxied URL using this proxy
 *
 * @param m {Array} The match from running this proxy's regexp against a URL spec
 * @type String
 */
Zotero.Proxy.prototype.toProper = function(m) {
	if (!Array.isArray(m)) {
		// make sure url has a trailing slash
		m = new URL(m).href;
		let match = this.regexp.exec(m);
		if (!match) {
			return m
		} else {
			m = match;
		}
	}
	let hostIdx = this.parameters.indexOf("%h");
	let scheme = m[0].indexOf('https') == 0 ? 'https://' : 'http://';
	if (hostIdx != -1) {
		var properURL = scheme+m[hostIdx+1]+"/";
	} else {
		var properURL = scheme+this.hosts[0]+"/";
	}

	// Replace `-` with `.` in https to support EZProxy HttpsHyphens.
	// Potentially troublesome with domains that contain dashes
	if (scheme == "https://" ||
		!properURL.includes('.')) {
		properURL = properURL.replace(/-/g, '.');
	}

	if (this.indices["%p"]) {
		properURL += m[this.parameters.indexOf("%p")+1];
	} else {
		var dir = m[this.parameters.indexOf("%d")+1];
		var file = m[this.parameters.indexOf("%f")+1];
		if (dir !== "") properURL += dir+"/";
		properURL += file;
	}

	return properURL;
}

/**
 * Converts an unproxied URL to a proxied URL using this proxy
 *
 * @param {Object|String} uri The URI corresponding to the unproxied URL
 * @type String
 */
Zotero.Proxy.prototype.toProxy = function(uri) {
	if (typeof uri == "string") {
		uri = new URL(uri);
	}
	if (this.regexp.exec(uri.href) || Zotero.Proxies._isBlacklisted(uri.hostname)) {
		return uri.href;
	}
	var proxyURL = this.scheme;

	for(var i=this.parameters.length-1; i>=0; i--) {
		var param = this.parameters[i];
		var value = "";
		if (param == "%h") {
			value = uri.protocol == 'https:' ? uri.hostname.replace(/\./g, '-') : uri.hostname;
		} else if (param == "%p") {
			value = uri.pathname.substr(1) + uri.search;
		}

		proxyURL = proxyURL.substr(0, this.indices[param])+value+proxyURL.substr(this.indices[param]+2);
	}

	if (proxyURL.includes('://')) {
		return proxyURL;
	}
	return uri.protocol + '//' + proxyURL;
}

/**
 * Generate a display name for the proxy (e.g., "proxy.example.edu (HTTPS)")
 *
 * @return {String}
 */
Zotero.Proxy.prototype.toDisplayName = function () {
	try {
		var parts = this.scheme.match(/^(?:(?:[^:]+):\/\/)?([^\/]+)/);
		var domain = parts[1]
			// Include part after %h, if it's present
			.split('%h').pop()
			// Trim leading punctuation after the %h
			.match(/\W(.+)/)[1];
		return domain;
	}
	catch (e) {
		Zotero.logError(`Invalid proxy ${this.scheme}: ${e}`);
		return this.scheme;
	}
}

if (typeof process === 'object' && process + '' === '[object process]'){
	module.exports = { Proxy: Zotero.Proxy, Proxies: Zotero.Proxies };
}
