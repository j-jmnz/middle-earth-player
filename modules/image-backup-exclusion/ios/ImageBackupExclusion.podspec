require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Expo autolinking links a local module on iOS only through its podspec; without this file the module is left out of the app.
Pod::Spec.new do |s|
  s.name           = 'ImageBackupExclusion'
  s.version        = package['version']
  s.summary        = "Marks the app's image directory as excluded from iCloud backup"
  s.description    = "Marks the app's image directory as excluded from iCloud backup"
  s.license        = 'UNLICENSED'
  s.author         = 'middle-earth-player'
  s.homepage       = 'https://github.com/j-jmnz/middle-earth-lcg'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
