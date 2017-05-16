var middleware = require("../middleware");
var Koa = require("koa");
var webpack = require("webpack");
var should = require("should");
var request = require("supertest");
var webpackConfig = require("./fixtures/server-test/webpack.config");
var webpackMultiConfig = require("./fixtures/server-test/webpack.array.config");


describe("Server", function() {
	var app;

	describe("requests", function() {
		before(function() {
			app = new Koa();
			var compiler = webpack(webpackConfig);
			var instance = middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				publicPath: "/public/",
			});
			app.use(instance);
			// Hack to add a mock HMR json file to the in-memory filesystem.
			instance.fileSystem.writeFileSync("/123a123412.hot-update.json", "[\"hi\"]");
		});

		it("GET request to bundle file", function(done) {
			request(app.listen()).get("/public/bundle.js")
			.expect("Content-Type", "application/javascript; charset=UTF-8")
			.expect("Content-Length", "2985")
			.expect("Access-Control-Allow-Origin", "*")
			.expect(200, /console\.log\("Hey\."\)/, done);
		});

		it("POST request to bundle file", function(done) {
			request(app.listen()).post("/public/bundle.js")
			.expect(404, done);
		});

		it("request to image", function(done) {
			request(app.listen()).get("/public/svg.svg")
			.expect("Content-Type", "image/svg+xml; charset=UTF-8")
			.expect("Content-Length", "4778")
			.expect("Access-Control-Allow-Origin", "*")
			.expect(200, done);
		});

		it("request to non existing file", function(done) {
			request(app.listen()).get("/public/nope")
			.expect("Content-Type", "text/plain; charset=utf-8")
			.expect(404, done);
		});

		it("request to HMR json", function(done) {
			request(app.listen()).get("/public/123a123412.hot-update.json")
			.expect("Content-Type", "application/json; charset=UTF-8")
			.expect(200, /\[\"hi\"\]/, done);
		});

		it("request to directory", function(done) {
			request(app.listen()).get("/public/")
			.expect("Content-Type", "text/html; charset=UTF-8")
			.expect("Content-Length", "10")
			.expect("Access-Control-Allow-Origin", "*")
			.expect(200, /My\ Index\./, done);
		});

		it("invalid range header", function(done) {
			request(app.listen()).get("/public/svg.svg")
			.set("Range", "bytes=6000-")
			.expect(416, done);
		});

		it("valid range header", function(done) {
			request(app.listen()).get("/public/svg.svg")
			.set("Range", "bytes=3000-3500")
			.expect("Content-Length", "501")
			.expect("Content-Range", "bytes 3000-3500/4778")
			.expect(206, done);
		});

		it("request to non-public path", function(done) {
			request(app.listen()).get("/nonpublic/")
			.expect("Content-Type", "text/plain; charset=utf-8")
			.expect(404, done);
		});
	});

	describe("lazy mode", function() {
		before(function() {
			app = new Koa();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				lazy: true,
				publicPath: "/",
			}));
		});

		it("GET request to bundle file", function(done) {
			request(app.listen()).get("/bundle.js")
			.expect("Content-Length", "2985")
			.expect(200, /console\.log\("Hey\."\)/, done);
		});
	});

	describe("custom headers", function() {
		before(function() {
			app = new Koa();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				headers: { "X-nonsense-1": "yes", "X-nonsense-2": "no" }
			}));
		});

		it("request to bundle file", function(done) {
			request(app.listen()).get("/bundle.js")
			.expect("X-nonsense-1", "yes")
			.expect("X-nonsense-2", "no")
			.expect(200, done);
		});
	});

	describe("MultiCompiler", function() {
		before(function() {
			app = new Koa();
			var compiler = webpack(webpackMultiConfig);
			var instance = middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				publicPath: "/",
			});
			app.use(instance);
		});

		it("request to both bundle files", function(done) {
			request(app.listen()).get("/foo.js")
			.expect(200, function() {
				request(app.listen()).get("/bar.js")
				.expect(200, done);
			});
		});
	});


	describe("server side render", function() {
		var locals;
		before(function() {
			app = new Koa();
			var compiler = webpack(webpackConfig);
			app.use(middleware(compiler, {
				stats: "errors-only",
				quiet: true,
				serverSideRender: true,
			}));
			app.use(function(ctx) {
				locals = ctx.state;
				ctx.status = 200;
			});
		});

		it("request to bundle file", function(done) {
			request(app.listen()).get("/foo/bar")
			.expect(200, function() {
				should.exist(locals.webpackStats);
				done();
			});
		});
	});
});
