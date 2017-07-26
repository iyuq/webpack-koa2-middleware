/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Qi Yu @iyuq
 */
/*global Promise*/
const webpackMiddleware = require("webpack-dev-middleware");

// constructor for the middleware
module.exports = function(compiler, options) {
	const instance = webpackMiddleware(compiler, options);

	function waitMiddleware() {
		return new Promise((resolve, reject) => {
			instance.waitUntilValid(() => {
				resolve(true);
			});

			compiler.plugin("failed", (error) => {
				reject(error);
			});
		});
	}

	function webpackKoaMiddleware(ctx, next) {
		return waitMiddleware().then(() => {
			const res = {
				locals: ctx.state,
				send(content) {
					if(ctx.status === 404) {
						ctx.status = 200;
					}
					ctx.body = content;
				},
				setHeader(field, value) {
					ctx.set(field, value);
				},
				get statusCode() {
					return ctx.response.status;
				},
				set statusCode(code) {
					ctx.response.status = code;
				}
			};
			return instance(ctx.req, res, next);
		});
	}

	webpackKoaMiddleware.getFilenameFromUrl = instance.getFilenameFromUrl;
	webpackKoaMiddleware.waitUntilValid = instance.waitUntilValid;
	webpackKoaMiddleware.invalidate = instance.invalidate;
	webpackKoaMiddleware.close = instance.close;
	webpackKoaMiddleware.fileSystem = instance.fileSystem;

	return webpackKoaMiddleware;
};
