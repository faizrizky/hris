package expo.modules.hrisface

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Deteksi wajah di perangkat (ML Kit) untuk uji kehadiran (liveness). Hanya
// mengembalikan ukuran/sudut/mata terbuka; gambar tidak dikirim ke mana pun.
class HrisFaceModule : Module() {
  private val detector by lazy {
    FaceDetection.getClient(
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .setMinFaceSize(0.3f)
        .build()
    )
  }

  override fun definition() = ModuleDefinition {
    Name("HrisFace")

    Function("supported") { true }

    // Hasil: { count, yaw, eyesOpen, size } ; yaw derajat, eyesOpen 0..1 (terkecil
    // dari dua mata, -1 bila tidak terbaca), size = lebar wajah / lebar foto.
    AsyncFunction("detect") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "Konteks tidak tersedia", null)
        return@AsyncFunction
      }
      try {
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        detector.process(image)
          .addOnSuccessListener { faces ->
            val f = faces.maxByOrNull { it.boundingBox.width() }
            val left = f?.leftEyeOpenProbability
            val right = f?.rightEyeOpenProbability
            promise.resolve(
              mapOf(
                "count" to faces.size,
                "yaw" to (f?.headEulerAngleY?.toDouble() ?: 0.0),
                "eyesOpen" to (if (left != null && right != null) minOf(left, right).toDouble() else -1.0),
                "size" to (if (f != null) f.boundingBox.width().toDouble() / image.width else 0.0)
              )
            )
          }
          .addOnFailureListener { e -> promise.reject("E_DETECT", e.message ?: "gagal", e) }
      } catch (e: Exception) {
        promise.reject("E_DETECT", e.message ?: "gagal", e)
      }
    }
  }
}
