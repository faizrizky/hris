import ExpoModulesCore
import Foundation

// iOS: CLOCK_MONOTONIC_RAW menghitung sejak boot termasuk saat tidur dan tidak
// ikut berubah saat jam diubah. Identitas boot tidak tersedia (dikembalikan -1);
// JS hanya bisa mendeteksi restart dari nilai yang mengecil.
public class HrisClockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HrisClock")

    Function("elapsedRealtimeMs") { () -> Double in
      Double(clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)) / 1_000_000.0
    }

    Function("bootCount") { () -> Int in -1 }

    Function("autoTimeEnabled") { () -> Bool? in nil }
  }
}
