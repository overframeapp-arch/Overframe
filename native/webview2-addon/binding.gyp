{
  "targets": [{
    "target_name": "webview2_addon",
    "sources": [ "src/webview2_addon.cpp" ],
    "include_dirs": [
      "<(module_root_dir)/include",
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "libraries": [
      "<(module_root_dir)/lib/WebView2LoaderStatic.lib",
      "ole32.lib",
      "oleaut32.lib",
      "shlwapi.lib",
      "version.lib"
    ],
    "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE" ],
    "msvs_settings": {
      "VCCLCompilerTool": {
        "ExceptionHandling": 1,
        "AdditionalOptions": [ "/std:c++20" ]
      }
    },
    "conditions": [
      [ "OS=='win'", {
        "msvs_settings": {
          "VCLinkerTool": {
            "AdditionalDependencies": [
              "ole32.lib",
              "oleaut32.lib",
              "shlwapi.lib",
              "version.lib"
            ]
          }
        }
      }]
    ]
  }]
}
