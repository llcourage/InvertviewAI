load("@aspect_rules_js//js:defs.bzl", "js_binary")

js_binary(
    name = "electron_app",
    entry_point = "dist/main.js",
    data = glob([
        "dist/**/*",
        "renderer/**/*",
        "package.json",
    ]),
)
