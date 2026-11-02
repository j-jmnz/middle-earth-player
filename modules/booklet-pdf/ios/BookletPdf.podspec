require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Expo autolinking links a local module on iOS only through its podspec; without this file the module is left out of the app.
Pod::Spec.new do |s|
  s.name           = 'BookletPdf'
  s.version        = package['version']
  s.summary        = 'Reads a bundled or imported booklet PDF with PDFKit and reports its page count'
  s.description    = 'Reads a bundled or imported booklet PDF with PDFKit and reports its page count'
  s.license        = 'UNLICENSED'
  s.author         = 'middle-earth-lcg'
  s.homepage       = 'https://github.com/j-jmnz/middle-earth-lcg'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
