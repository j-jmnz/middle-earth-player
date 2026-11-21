require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Expo autolinking links a local module on iOS only through its podspec; without this file the module is left out of the app.
Pod::Spec.new do |s|
  s.name           = 'OtherAudio'
  s.version        = package['version']
  s.summary        = "Tells the app whether another app's audio is playing"
  s.description    = "Tells the app whether another app's audio is playing, so its music does not start over it"
  s.license        = 'UNLICENSED'
  s.author         = 'middle-earth-player'
  s.homepage       = 'https://github.com/j-jmnz/middle-earth-player'
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
