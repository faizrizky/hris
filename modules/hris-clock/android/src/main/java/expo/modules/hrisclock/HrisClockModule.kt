package expo.modules.hrisclock

import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Penghitung waktu yang tidak ikut berubah saat pengguna mengubah jam HP.
// elapsedRealtime menghitung sejak HP menyala, termasuk saat tidur (deep sleep).
// bootCount naik setiap HP restart; keduanya dipakai bersama supaya "jam
// terpercaya" tidak salah hitung setelah restart.
class HrisClockModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HrisClock")

    Function("elapsedRealtimeMs") {
      SystemClock.elapsedRealtime().toDouble()
    }

    Function("bootCount") {
      val resolver = appContext.reactContext?.contentResolver
      if (resolver == null) -1 else Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT, -1)
    }

    // Apakah "Tanggal & waktu otomatis" menyala (jam disinkronkan operator/jaringan).
    Function("autoTimeEnabled") {
      val resolver = appContext.reactContext?.contentResolver
      if (resolver == null) null else Settings.Global.getInt(resolver, Settings.Global.AUTO_TIME, 0) == 1
    }
  }
}
