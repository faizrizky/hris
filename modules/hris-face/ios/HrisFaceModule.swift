import ExpoModulesCore

// iOS belum didukung: JS melewati verifikasi wajah bila supported() false.
public class HrisFaceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HrisFace")
    Function("supported") { () -> Bool in false }
    AsyncFunction("detect") { (uri: String) -> [String: Double] in
      ["count": 0, "yaw": 0, "pitch": 0, "eyesOpen": -1, "size": 0]
    }
    AsyncFunction("embed") { (uri: String) -> [Double]? in nil }
  }
}
