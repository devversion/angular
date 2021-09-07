"""Allows different paths for these imports in google3.
"""

load(
    # Replaced with "//@bazel/typescript/internal:..." in published package
    "@npm//@bazel/typescript/internal:build_defs.bzl",
    _tsc_wrapped_tsconfig = "tsc_wrapped_tsconfig",
)
load(
    # Replaced with "//@bazel/typescript/internal:..." in published package
    "@npm//@bazel/typescript/internal:common/compilation.bzl",
    _COMMON_ATTRIBUTES = "COMMON_ATTRIBUTES",
    _COMMON_OUTPUTS = "COMMON_OUTPUTS",
    _DEPS_ASPECTS = "DEPS_ASPECTS",
    _compile_ts = "compile_ts",
    _ts_providers_dict_to_struct = "ts_providers_dict_to_struct",
)
load(
    # Replaced with "//@bazel/typescript/internal:..." in published package
    "@npm//@bazel/typescript/internal:ts_config.bzl",
    _TsConfigInfo = "TsConfigInfo",
)
load(
    "@build_bazel_rules_nodejs//:providers.bzl",
    _LinkablePackageInfo = "LinkablePackageInfo",
    _NpmPackageInfo = "NpmPackageInfo",
    _JSEcmaScriptModuleInfo = "JSEcmaScriptModuleInfo",
    _js_ecma_script_module_info = "js_ecma_script_module_info",
    _js_module_info = "js_module_info",
    _js_named_module_info = "js_named_module_info",
    _node_modules_aspect = "node_modules_aspect",
)
load("//packages/bazel/src/ng_module:partial_compilation.bzl",
  _partial_compilation_action = "partial_compilation_action")

load("//packages/bazel/src/ng_module:partial_compilation_aspect.bzl",
  _partial_compilation_aspect = "partial_compilation_aspect",
  _NgPartialCompilationEsm = "NgPartialCompilationEsm")

LinkablePackageInfo = _LinkablePackageInfo
NpmPackageInfo = _NpmPackageInfo
node_modules_aspect = _node_modules_aspect

tsc_wrapped_tsconfig = _tsc_wrapped_tsconfig
COMMON_ATTRIBUTES = _COMMON_ATTRIBUTES
COMMON_OUTPUTS = _COMMON_OUTPUTS
compile_ts = _compile_ts
DEPS_ASPECTS = _DEPS_ASPECTS
ts_providers_dict_to_struct = _ts_providers_dict_to_struct

# Should be defined as `BuildSettingInfo` from Skylib, but a dependency on
# Skylib is not necessary here because this is only used in google3 where Skylib
# is loaded differently anyways where this file is overridden.
BuildSettingInfo = provider(doc = "Not used outside google3.")

DEFAULT_API_EXTRACTOR = (
    # BEGIN-DEV-ONLY
    "@npm" +
    # END-DEV-ONLY
    "//@angular/bazel/bin:api-extractor"
)
DEFAULT_NG_COMPILER = (
    # BEGIN-DEV-ONLY
    "@npm" +
    # END-DEV-ONLY
    "//@angular/bazel/bin:ngc-wrapped"
)
DEFAULT_NG_XI18N = (
    # BEGIN-DEV-ONLY
    "@npm" +
    # END-DEV-ONLY
    "//@angular/bazel/bin:xi18n"
)
FLAT_DTS_FILE_SUFFIX = ".bundle.d.ts"
TsConfigInfo = _TsConfigInfo

JSEcmaScriptModuleInfo = _JSEcmaScriptModuleInfo
js_ecma_script_module_info = _js_ecma_script_module_info
js_module_info = _js_module_info
js_named_module_info = _js_named_module_info

# Exposed through `external.bzl` so that this can be replaced with an
# empty macro in google3 where compilations cannot be replayed / where
# partial compilation output is not needed at all.
partial_compilation_action = _partial_compilation_action
partial_compilation_aspect = _partial_compilation_aspect
NgPartialCompilationEsm = _NgPartialCompilationEsm
PARTIAL_COMPILATION_CREATE_TSCONFIG = "//packages/bazel/src/ng_module:create_partial_compilation_tsconfig"
