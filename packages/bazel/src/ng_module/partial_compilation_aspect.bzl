NgPartialCompilationEsm = provider(
    doc = """Partial compilation ES module output for Angular.""",
    fields = {
        "direct_sources": "Depset of direct files",
        "sources": "Depset of direct and transitive files",
    },
)

def _partial_compilation_aspect(target, ctx):
    if NgPartialCompilationEsm in target:
      return []

    deps = getattr(ctx.rule.attr, "deps", [])
    transitive_sources = []

    for dep in deps:
        if NgPartialCompilationEsm in dep:
            transitive_sources.append(dep[NgPartialCompilationEsm].sources)

    return [
        NgPartialCompilationEsm(
            direct_sources = depset(),
            sources = depset(transitive = transitive_sources)
        )
    ]

partial_compilation_aspect = aspect(
    implementation = _partial_compilation_aspect,
    attr_aspects = ['deps'],
)
