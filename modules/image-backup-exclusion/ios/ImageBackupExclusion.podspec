# CocoaPods only compiles a local Expo module's Swift when the module has a podspec; without it autolinking skips the
# module on iOS and requireOptionalNativeModule finds nothing.
Pod::Spec.new do |s|
  s.name           = 'ImageBackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Excludes the card image directory from iCloud backup.'
  s.description    = 'Excludes the card image directory from iCloud backup.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
