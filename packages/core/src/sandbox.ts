
// XXX: there are multiple _loadTranslator methods....
// //
// /**
//  * Overload {@link Zotero.Translate.Base#_loadTranslator} to prepare translator IO
//  */
// Zotero.Translate.Import.prototype._loadTranslator = function(translator) {
// 	return Zotero.Translate.Base.prototype._loadTranslator.call(this, translator)
// 	.then(function() {
// 		return this._loadTranslatorPrepareIO(translator);
// 	}.bind(this));
// }

// /**
//  * Prepare translator IO
//  */
// Zotero.Translate.Import.prototype._loadTranslatorPrepareIO = Zotero.Promise.method(function (translator) {
// 	var configOptions = this._translatorInfo.configOptions;
// 	var dataMode = configOptions ? configOptions["dataMode"] : "";

// 	if(!this._io) {
// 		if(Zotero.Translate.IO.Read && this.location && this.location instanceof Components.interfaces.nsIFile) {
// 			this._io = new Zotero.Translate.IO.Read(this.location, this._sandboxManager);
// 		} else {
// 			this._io = new Zotero.Translate.IO.String(this._string, this.path ? this.path : "", this._sandboxManager);
// 		}
// 	}

// 	this._io.init(dataMode);
// 	this._sandboxManager.importObject(this._io);
// });
// /**
//  * Loads the translator into its sandbox
//  * @param {Zotero.Translator} translator
//  * @return {Promise}
//  */
// _loadTranslator: Zotero.Promise.method(function (translator) {
// 	var sandboxLocation = this._getSandboxLocation();
// 	if(!this._sandboxLocation || sandboxLocation !== this._sandboxLocation) {
// 		this._sandboxLocation = sandboxLocation;
// 		this._generateSandbox();
// 	}

// 	this._currentTranslator = translator;

// 	if (this.type == 'web') {
// 		// Pass on the proxy of the parent translate
// 		if (this._parentTranslator) {
// 			this._proxy = this._parentTranslator._proxy;
// 		} else {
// 			this._proxy = translator.proxy;
// 		}
// 	} else {
// 		// Use proxy only for web translators
// 		this._proxy = null;
// 	}
// 	this._runningAsyncProcesses = 0;
// 	this._returnValue = undefined;
// 	this._aborted = false;
// 	this.saveQueue = [];

// 	var parse = function(code) {
// 		Zotero.debug("Translate: Parsing code for " + translator.label + " "
// 			+ "(" + translator.translatorID + ", " + translator.lastUpdated + ")", 4);
// 		// This might throw but it's better than catching and calling complete(false) here
// 		// since then other execution paths are not aware of this failing and continue running
// 		// at least in Import translation detection, causing weird race conditions.
// 		// The code that calls this function (which is really only code in this file)
// 		// should expect a throw and call complete(false) after catching.
// 		this._sandboxManager.eval(
// 			"var exports = {}, ZOTERO_TRANSLATOR_INFO = " + code,
// 			[
// 				"detect" + this._entryFunctionSuffix,
// 				"do" + this._entryFunctionSuffix,
// 				"exports",
// 				"ZOTERO_TRANSLATOR_INFO"
// 			],
// 			(translator.file ? translator.file.path : translator.label)
// 		);

// 		this._translatorInfo = this._sandboxManager.sandbox.ZOTERO_TRANSLATOR_INFO;
// 	}.bind(this);

// 	if (this.noWait) {
// 		let codePromise = this._translatorProvider.getCodeForTranslator(translator);
// 		if (!codePromise.isResolved()) {
// 			throw new Error("Code promise is not resolved in noWait mode");
// 		}
// 		parse(codePromise.value());
// 	}
// 	else {
// 		return this._translatorProvider.getCodeForTranslator(translator).then(parse);
// 	}
// }),


// 	/**
//  * @class Manages the translator sandbox
//  */
// Zotero.Translate.SandboxManager = function() {
// 		this.sandbox = {
// 			Zotero: {},
// 			Promise,
// 		};
// };

// Zotero.Translate.SandboxManager.prototype = {
// 		/**
// 		 * Evaluates code in the sandbox
// 		 * @param {String} code Code to evaluate
// 		 * @param {String[]} functions Functions to import into the sandbox (rather than leaving
// 		 *                                 as inner functions)
// 		 * @param {String?} path The source path of the code being evaluated
// 		 */
// 		eval: function(code, functions, path) {
// 			// delete functions to import
// 			for (var i in functions) {
// 				delete this.sandbox[functions[i]];
// 			}

// 			// Prepend sandbox properties within eval environment (what a mess (1))
// 			for (var prop in this.sandbox) {
// 				code = 'var ' + prop + ' = this.sandbox.' + prop + ';' + code;
// 			}

// 			// Import inner functions back into the sandbox
// 			for (var i in functions) {
// 				// TODO: Omit in translate.js?
// 				if (functions[i] == 'detectExport') continue;

// 				try {
// 					code += '\nthis.sandbox.' + functions[i] + ' = ' + functions[i] + ';';
// 				} catch (e) {
// 				}
// 			}

// 			if (path) {
// 				code += `\n//# sourceURL=${encodeURI(path)}\n`;
// 			}

// 			// Eval in a closure
// 			(function() {
// 				eval(code);
// 			}).call(this);
// 		},

// 		/**
// 		 * Imports an object into the sandbox
// 		 *
// 		 * @param {Object} object Object to be imported (under attachTo)
// 		 * @param {Boolean} passTranslateAsFirstArgument Whether the translate instance should be passed
// 		 *		as the first argument to the function.
// 		 * @param {Object} attachTo An item from this.sandbox to which the object will be attached
// 		 * 		defaults to this.sandbox.Zotero
// 		 */
// 		importObject: function(object, passTranslateAsFirstArgument, attachTo) {
// 			if(!attachTo) attachTo = this.sandbox.Zotero;

// 			for(var key in (object.__exposedProps__ ? object.__exposedProps__ : object)) {
// 				if(Function.prototype[key]) continue;
// 				if(typeof object[key] === "function" || typeof object[key] === "object") {
// 					// magic closures
// 					attachTo[key] = new (function() {
// 						var fn = object[key];
// 						return function() {
// 							var args = (passTranslateAsFirstArgument ? [passTranslateAsFirstArgument] : []);
// 							for(var i=0; i<arguments.length; i++) {
// 								args.push(arguments[i]);
// 							}

// 							return fn.apply(object, args);
// 						};
// 					})

// 					// attach members
// 					this.importObject(object[key], passTranslateAsFirstArgument ? passTranslateAsFirstArgument : null, attachTo[key]);
// 				} else {
// 					attachTo[key] = object[key];
// 				}
// 			}
// 		}
// }


// /**
//  * Generates a sandbox for scraping/scraper detection
//  */
// "_generateSandbox":function() {
// 	Zotero.debug("Translate: Binding sandbox to "+(typeof this._sandboxLocation == "object" ? this._sandboxLocation.document.location : this._sandboxLocation), 4);
// 	this._sandboxManager = new Zotero.Translate.SandboxManager(this._sandboxLocation);

// 	this._sandboxManager.importObject(this.Sandbox, this);
// 	this._sandboxManager.importObject({"Utilities":new Zotero.Utilities.Translate(this)});

// 	this._sandboxZotero = this._sandboxManager.sandbox.Zotero;

// 	this._sandboxZotero.Item = this._makeSandboxItem();
// 	if (this instanceof Zotero.Translate.Export || this instanceof Zotero.Translate.Import) {
// 		this._sandboxZotero.Collection = this._makeSandboxCollection();
// 	}

// 	this._sandboxZotero.Utilities.HTTP = this._sandboxZotero.Utilities;

// 	this._sandboxZotero.isBookmarklet = Zotero.isBookmarklet || false;
// 	this._sandboxZotero.isConnector = Zotero.isConnector || false;
// 	this._sandboxZotero.isServer = Zotero.isServer || false;
// 	this._sandboxZotero.parentTranslator = this._parentTranslator
// 		&& this._parentTranslator._currentTranslator ?
// 		this._parentTranslator._currentTranslator.translatorID : null;

// 	// create shortcuts
// 	this._sandboxManager.sandbox.Z = this._sandboxZotero;
// 	this._sandboxManager.sandbox.ZU = this._sandboxZotero.Utilities;

// 	// Add helper functions
// 	if (this.type == 'web' || this.type == 'search') {
// 		this._sandboxManager.sandbox.attr = this._attr.bind(this);
// 		this._sandboxManager.sandbox.text = this._text.bind(this);
// 		this._sandboxManager.sandbox.innerText = this._innerText.bind(this);
// 		this._sandboxManager.sandbox.request = this._sandboxZotero.Utilities.request.bind(this._sandboxZotero.Utilities);
// 		this._sandboxManager.sandbox.requestText = this._sandboxZotero.Utilities.requestText.bind(this._sandboxZotero.Utilities);
// 		this._sandboxManager.sandbox.requestJSON = this._sandboxZotero.Utilities.requestJSON.bind(this._sandboxZotero.Utilities);
// 		this._sandboxManager.sandbox.requestDocument = this._sandboxZotero.Utilities.requestDocument.bind(this._sandboxZotero.Utilities);
// 	}
// },






// note for the future: for imports it gets overriden to also _loadTranslatorPrepareIO
// /**
//  * Loads the translator into its sandbox
//  * @param {Zotero.Translator} translator
//  * @return {Promise}
//  */
// _loadTranslator: Zotero.Promise.method(function (translator) {
// 	var sandboxLocation = this._getSandboxLocation();
// 	if(!this._sandboxLocation || sandboxLocation !== this._sandboxLocation) {
// 		this._sandboxLocation = sandboxLocation;
// 		this._generateSandbox();
// 	}

// 	this._currentTranslator = translator;

// 	if (this.type == 'web') {
// 		// Pass on the proxy of the parent translate
// 		if (this._parentTranslator) {
// 			this._proxy = this._parentTranslator._proxy;
// 		} else {
// 			this._proxy = translator.proxy;
// 		}
// 	} else {
// 		// Use proxy only for web translators
// 		this._proxy = null;
// 	}
// 	this._runningAsyncProcesses = 0;
// 	this._returnValue = undefined;
// 	this._aborted = false;
// 	this.saveQueue = [];

// 	var parse = function(code) {
// 		Zotero.debug("Translate: Parsing code for " + translator.label + " "
// 			+ "(" + translator.translatorID + ", " + translator.lastUpdated + ")", 4);
// 		// This might throw but it's better than catching and calling complete(false) here
// 		// since then other execution paths are not aware of this failing and continue running
// 		// at least in Import translation detection, causing weird race conditions.
// 		// The code that calls this function (which is really only code in this file)
// 		// should expect a throw and call complete(false) after catching.
// 		this._sandboxManager.eval(
// 			"var exports = {}, ZOTERO_TRANSLATOR_INFO = " + code,
// 			[
// 				"detect" + this._entryFunctionSuffix,
// 				"do" + this._entryFunctionSuffix,
// 				"exports",
// 				"ZOTERO_TRANSLATOR_INFO"
// 			],
// 			(translator.file ? translator.file.path : translator.label)
// 		);

// 		this._translatorInfo = this._sandboxManager.sandbox.ZOTERO_TRANSLATOR_INFO;
// 	}.bind(this);

// 	if (this.noWait) {
// 		let codePromise = this._translatorProvider.getCodeForTranslator(translator);
// 		if (!codePromise.isResolved()) {
// 			throw new Error("Code promise is not resolved in noWait mode");
// 		}
// 		parse(codePromise.value());
// 	}
// 	else {
// 		return this._translatorProvider.getCodeForTranslator(translator).then(parse);
// 	}
// }),






// translate: Zotero.Promise.method(function (options = {}, ...args) {		// initialize properties specific to each translation
// 	if (typeof options == 'number') {
// 		Zotero.debug("Translate: translate() now takes an object -- update your code", 2);
// 		options = {
// 			libraryID: options,
// 			saveAttachments: args[0],
// 			selectedItems: args[1]
// 		};
// 	}

// 	var me = this;
// 	var deferred = Zotero.Promise.defer()

// 	if(!this.translator || !this.translator.length) {
// 		Zotero.debug("Translate: translate called without specifying a translator. Running detection first.");
// 		this.setHandler('translators', function(me, translators) {
// 			if(!translators.length) {
// 				me.complete(false, "Could not find an appropriate translator");
// 			} else {
// 				me.setTranslator(translators);
// 				deferred.resolve(Zotero.Translate.Base.prototype.translate.call(me, options));
// 			}
// 		});
// 		this.getTranslators();
// 		return deferred.promise;
// 	}

// 	this._currentState = "translate";

// 	this._sessionID = options.sessionID;
// 	this._libraryID = options.libraryID;
// 	if (options.collections && !Array.isArray(options.collections)) {
// 		throw new Error("'collections' must be an array");
// 	}
// 	this._collections = options.collections;
// 	this._saveAttachments = options.saveAttachments === undefined || options.saveAttachments;
// 	this._linkFiles = options.linkFiles;
// 	this._forceTagType = options.forceTagType;
// 	this._saveOptions = options.saveOptions;

// 	this._savingAttachments = [];
// 	this._savingItems = 0;
// 	this._waitingForSave = false;

// 	// Attach handlers for promise
// 	var me = this;
// 	var doneHandler = function (obj, returnValue) {
// 		if (returnValue) deferred.resolve(me.newItems);
// 		me.removeHandler("done", doneHandler);
// 		me.removeHandler("error", errorHandler);
// 	};
// 	var errorHandler = function (obj, error) {
// 		deferred.reject(error);
// 		me.removeHandler("done", doneHandler);
// 		me.removeHandler("error", errorHandler);
// 	};
// 	this.setHandler("done", doneHandler);
// 	this.setHandler("error", errorHandler);

// 	// need to get translator first
// 	if (typeof this.translator[0] !== "object") {
// 		this.translator[0] = this._translatorProvider.get(this.translator[0]);
// 	}

// 	// Zotero.Translators.get() returns a promise in the connectors, but we don't expect it to
// 	// otherwise
// 	if (!Zotero.isConnector && this.translator[0].then) {
// 		throw new Error("Translator should not be a promise in non-connector mode");
// 	}

// 	if (this.noWait) {
// 		var loadPromise = this._loadTranslator(this.translator[0]);
// 		if (!loadPromise.isResolved()) {
// 			return Zotero.Promise.reject(new Error("Load promise is not resolved in noWait mode"));
// 		}
// 		this._translateTranslatorLoaded();
// 	}
// 	else if (this.translator[0].then) {
// 		Zotero.Promise.resolve(this.translator[0])
// 		.then(function (translator) {
// 			this.translator[0] = translator;
// 			this._loadTranslator(translator)
// 				.then(() => this._translateTranslatorLoaded())
// 				.catch(e => deferred.reject(e));
// 		}.bind(this));
// 	}
// 	else {
// 		this._loadTranslator(this.translator[0])
// 			.then(() => this._translateTranslatorLoaded())
// 			.catch(e => deferred.reject(e));
// 	}

// 	return deferred.promise;
// }),




// "_translateTranslatorLoaded": Zotero.Promise.method(function() {
// 	// set display options to default if they don't exist
// 	if(!this._displayOptions) this._displayOptions = this._translatorInfo.displayOptions || {};

// 	var loadPromise = this._prepareTranslation();
// 	if (this.noWait) {
// 		if (!loadPromise.isResolved()) {
// 			throw new Error("Load promise is not resolved in noWait mode");
// 		}
// 		rest.apply(this, arguments);
// 	} else {
// 		return loadPromise.then(() => rest.apply(this, arguments))
// 	}

// 	function rest() {
// 		Zotero.debug("Translate: Beginning translation with " + this.translator[0].label);

// 		this.incrementAsyncProcesses("Zotero.Translate#translate()");

// 		// translate
// 		try {
// 			let fn = this._sandboxManager.sandbox["do" + this._entryFunctionSuffix];
// 			if (!fn) {
// 				this.complete(false, new Error(`Translator has no do${this._entryFunctionSuffix} function`));
// 				return;
// 			}

// 			let maybePromise = Function.prototype.apply.call(
// 				fn,
// 				null,
// 				this._getParameters()
// 			);

// 			if (maybePromise) {
// 				maybePromise
// 					.then(() => this.decrementAsyncProcesses("Zotero.Translate#translate()"))
// 					.catch(e => this.complete(false, e));
// 				return;
// 			}
// 		} catch (e) {
// 			this.complete(false, e);
// 			return false;
// 		}

// 		this.decrementAsyncProcesses("Zotero.Translate#translate()");
// 	}
// }),




class Sandbox {
	constructor() {
	this.sandbox ={};
	}
	eval(code, functions, path) {
	// for (var i in functions) {
	// 			delete this.sandbox[functions[i]];
	// 		}
	// 		// Prepend sandbox properties within eval environment (what a mess (1))
	// 		for (var prop in this.sandbox) {
	// 			code = 'var ' + prop + ' = this.sandbox.' + prop + ';' + code;
	// 		}
	// 					// Import inner functions back into the sandbox
	// 		for (var i in functions) {
	// 			// TODO: Omit in translate.js?
	// 			if (functions[i] == 'detectExport') continue;

	// 			try {
	// 				code += '\nthis.sandbox.' + functions[i] + ' = ' + functions[i] + ';';
	// 			} catch (e) {
	// 			}
	// 		}

	// 		if (path) {
	// 			code += `\n//# sourceURL=${encodeURI(path)}\n`;
	// 		}

	// 		// Eval in a closure
	// 		(function() {
	// 			eval(code);
	// 		}).call(this);}
	}
// 			// delete functions to import
//

// 			// Prepend sandbox properties within eval environment (what a mess (1))
// 			for (var prop in this.sandbox) {
// 				code = 'var ' + prop + ' = this.sandbox.' + prop + ';' + code;
// 			}



}
