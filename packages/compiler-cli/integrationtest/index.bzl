"""
  Macro that can be used to build an Angular project with Bazel using NGC standalone. This is
  a wrapper around the "ngc" CLI binary and is used for integration testing.
"""
def build_ngc(name, srcs, outs, tsconfig):
  native.genrule(
      name = name,
      srcs = srcs,
      outs = outs,
      cmd = """
        ./$(location //packages/compiler-cli/integrationtest:build-ngc) $(@D) $(location %s)
      """ % tsconfig,
      tools = ["//packages/compiler-cli/integrationtest:build-ngc"]
  )
