def _build_ngc(ctx):
    package_import_files = []

    args = ctx.actions.args()

    args.add("/".join([ctx.bin_dir.path, ctx.label.package]))
    args.add(ctx.files.tsconfig)

    for import_target, import_name in ctx.attr.npm_imports.items():
        pkg_files = import_target.files.to_list()

        if len(pkg_files) > 1:
            pkg_root = "%s/%s" % (import_target.label.workspace_root, import_target.label.package)
        else:
            pkg_root = pkg_files[0].path

        # Keep track of all import files that are required. This will be passed as
        # an input to the Bazel action.
        package_import_files += pkg_files

        args.add("%s,%s" % (import_name, pkg_root))

    ctx.actions.run(
        progress_message = "Running NGC for %s" % ctx.label,
        mnemonic = "NGCBuild",
        inputs = ctx.files.srcs + ctx.files.tsconfig + package_import_files,
        outputs = ctx.outputs.outs,
        executable = ctx.executable._build_ngc,
        arguments = [args],
    )

    return DefaultInfo(files = depset(ctx.outputs.outs))

build_ngc = rule(
    implementation = _build_ngc,
    attrs = {
        "srcs": attr.label_list(mandatory = True, allow_files = True),
        "tsconfig": attr.label(allow_single_file = True, mandatory = True),
        "outs": attr.output_list(mandatory = True, non_empty = True),
        "npm_imports": attr.label_keyed_string_dict(allow_files = True),

        "_build_ngc": attr.label(
            default = Label("//packages/compiler-cli/integrationtest:build-ngc"),
            executable = True,
            cfg = "host"
        ),
    },
)
