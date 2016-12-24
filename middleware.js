/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
/*global Promise*/
var mime = require("mime");
var getFilenameFromUrl = require("./lib/GetFilenameFromUrl");
var Shared = require("./lib/Shared");
var pathJoin = require("./lib/PathJoin");

// constructor for the middleware
module.exports = function(compiler, options) {
	var context = {
		state: false,
		webpackStats: undefined,
		callbacks: [],
		options: options,
		compiler: compiler,
		watching: undefined,
		forceRebuild: false
	};
	var shared = Shared(context);


	// The middleware function
	function webpackDevMiddleware(ctx, next) {
		function goNext() {
			if(!context.options.serverSideRender) return next();
			return new Promise(function(resolve) {
				shared.ready(function() {
					ctx.state.webpackStats = context.webpackStats;
					resolve();
				}, ctx.req);
			}).then(function() {
				return next();
			});
		}

		if(ctx.method !== "GET") {
			return goNext();
		}

		var filename = getFilenameFromUrl(context.options.publicPath, context.compiler.outputPath, ctx.url);
		if(filename === false) return goNext();

		return new Promise(function(resolve) {
			shared.handleRequest(filename, processRequest, ctx);
			function processRequest() {
				try {
					var stat = context.fs.statSync(filename);
					if(!stat.isFile()) {
						if(stat.isDirectory()) {
							filename = pathJoin(filename, context.options.index || "index.html");
							stat = context.fs.statSync(filename);
							if(!stat.isFile()) throw "next";
						} else {
							throw "next";
						}
					}
				} catch(e) {
					return resolve(goNext());
				}
				resolve();
			}
		}).then(function() {
			var content = context.fs.readFileSync(filename);
			content = shared.handleRangeHeaders(content, ctx);
			ctx.set("Access-Control-Allow-Origin", "*"); // To support XHR, etc.
			ctx.set("Content-Type", mime.lookup(filename) + "; charset=UTF-8");
			ctx.set("Content-Length", content.length);
			if(context.options.headers) {
				for(var name in context.options.headers) {
					ctx.set(name, context.options.headers[name]);
				}
			}
			// Express automatically sets the statusCode to 200, but not all servers do (Koa).
			ctx.status = ctx.statusCode || 200;
			ctx.body = content;
		});
	}

	webpackDevMiddleware.getFilenameFromUrl = getFilenameFromUrl.bind(this, context.options.publicPath, context.compiler.outputPath);
	webpackDevMiddleware.waitUntilValid = shared.waitUntilValid;
	webpackDevMiddleware.invalidate = shared.invalidate;
	webpackDevMiddleware.close = shared.close;
	webpackDevMiddleware.fileSystem = context.fs;
	return webpackDevMiddleware;
};