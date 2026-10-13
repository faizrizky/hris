Pod::Spec.new do |s|
  s.name           = 'HrisFace'
  s.version        = '0.1.0'
  s.summary        = 'Face liveness detection (Android only for now)'
  s.description    = 'Face liveness detection (Android only for now)'
  s.license        = 'MIT'
  s.author         = 'HRIS'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://example.com/hris-face.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
