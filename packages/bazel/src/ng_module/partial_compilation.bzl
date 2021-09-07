def _map_to_partial_compilation_file(file):
    return "%s.ivy-partial.js" % file.short_path[:-(len(file.extension) + 1)]

def partial_compilation_action(ctx, replay_params):
    name = ctx.label.name
    new_tsconfig = ctx.actions.declare_file("%s_partial_compilation.tsconfig.json" % name)
    output_dir = "%s_partial_ivy" % name
    type_output_base = "%s_partial_types" % name

    outputs = [
        ctx.actions.declare_file(_map_file_to_output_dir(f, output_dir))
        for f in replay_params.outputs
    ]

    ctx.actions.run(
        executable = ctx.executable._create_partial_compilation_tsconfig,
        inputs = [replay_params.tsconfig],
        outputs = [new_tsconfig],
        arguments = [
            replay_params.tsconfig.path,
            new_tsconfig.path,
        ],
    )

    replay_compiler_path = replay_params.compiler.short_path
    replay_compiler_name = replay_compiler_path.split("/")[-1]

    # We do not expect compilations, other than "ng_module" to be replayed.
    if not replay_compiler_name.startswith("ngc-wrapped"):
        fail("Unexpected compilation replay information.")

    inputs = [new_tsconfig] + replay_params.inputs.to_list()

    ctx.actions.run(
        progress_message = "Compiling Angular (partial compilation) %s" % name,
        inputs = inputs,
        outputs = outputs,
        # One at-sign makes this a params-file for `@bazel/worker`, enabling the worker strategy.
        # https://docs.bazel.build/versions/main/creating-workers.html#work-action-requirements.
        arguments = ["@@%s" % new_tsconfig.path],
        executable = ctx.executable.compiler,
        execution_requirements = {
            # https://docs.bazel.build/versions/main/persistent-workers.html#implementing-persistent-workers
            "supports-workers": "1",
        },
        mnemonic = "NgCompile",
    )

    return struct(
        outputs = outputs,
    )
