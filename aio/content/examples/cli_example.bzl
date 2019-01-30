load("//packages/bazel:index.bzl", "protractor_web_test_suite")
load("//tools:defaults.bzl", "ng_module", "ts_library")
load("@build_bazel_rules_typescript//:defs.bzl", "ts_devserver")

def cli_example(name,
                srcs,
                entry_module,
                assets = [],
                deps = [],
                server_assets = [],
                server_root_paths = [],
                server_index_html = "src/index.html"):

    ng_module(
        name = "%s_sources" % name,
        srcs = [":%s_environment_file" % name] + srcs,
        assets = assets,
        # TODO: FW-1004 Type checking is currently not complete.
        type_check = False,
        deps = deps,
        tsconfig = "//aio/content/examples:tsconfig-example.json",
    )

    native.genrule(
        name = "%s_environment_file" % name,
        outs = ["src/environments/environment.ts"],
        cmd = "echo 'export const environment = {production: false};' > $@"
    )

    ts_devserver(
        name = "%s_devserver" % name,
        entry_module = entry_module,
        index_html = server_index_html,
        port = 4200,
        scripts = ["@ngdeps//node_modules/tslib:tslib.js"],
        static_files = [
            "@ngdeps//node_modules/zone.js:dist/zone.js",
            # Needed because the examples can be bootstrapped in JIT mode.
            "@ngdeps//node_modules/reflect-metadata:Reflect.js",
        ],
        additional_root_paths = server_root_paths,
        deps = [":%s_sources" % name],
        data = server_assets,
    )

def cli_example_e2e(name, srcs, server, deps = []):
    ts_library(
        name = "%s_lib" % name,
        testonly = True,
        srcs = srcs,
        tsconfig = "//aio/content/examples:tsconfig-e2e.json",
        deps = [
            "//packages/private/testing",
            "@ngdeps//@types/jasminewd2",
            "@ngdeps//@types/selenium-webdriver",
            "@ngdeps//selenium-webdriver",
            "@ngdeps//protractor",
        ] + deps,
    )

    protractor_web_test_suite(
        name = "%s" % name,
        data = ["//packages/bazel/src/protractor/utils"],
        on_prepare = "//aio/content/examples:start-server.js",
        server = server,
        deps = [
            ":%s_lib" % name,
            "@ngdeps//protractor",
            "@ngdeps//selenium-webdriver",
        ],
    )
