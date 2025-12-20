load("@rules_nodejs//nodejs:defs.bzl", "nodejs_binary", "npm_package")

# Root package definition
package(default_visibility = ["//visibility:public"])

# Electron build target
nodejs_binary(
    name = "electron",
    entry_point = "//electron:src/main.ts",
    data = [
        "//electron:package.json",
        "//electron:src",
        "//electron:renderer",
    ],
    deps = [
        "@npm//electron",
    ],
)

# Website build target
npm_package(
    name = "website",
    srcs = glob([
        "website/**/*",
    ]),
    package_name = "interview-ai-website",
)




