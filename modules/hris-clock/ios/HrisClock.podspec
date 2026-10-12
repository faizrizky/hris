Pod::Spec.new do |s|
  s.name           = 'HrisClock'
  s.version        = '0.1.0'
  s.summary        = 'Monotonic clock for trusted offline check-in time'
  s.description    = 'Monotonic clock for trusted offline check-in time'
  s.license        = 'MIT'
  s.author         = 'HRIS'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://example.com/hris-clock.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
