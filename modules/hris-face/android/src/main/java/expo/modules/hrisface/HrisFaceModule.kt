package expo.modules.hrisface

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.FloatBuffer
import kotlin.math.sqrt

// Deteksi wajah (ML Kit) untuk uji kehadiran, dan embedding wajah (SFace lewat
// ONNX Runtime) untuk pencocokan. Semuanya di perangkat; gambar tidak dikirim.
class HrisFaceModule : Module() {
  private val detector by lazy {
    FaceDetection.getClient(
      FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
        .setMinFaceSize(0.15f)
        .build()
    )
  }

  private val env: OrtEnvironment by lazy { OrtEnvironment.getEnvironment() }
  private val session: OrtSession by lazy {
    val bytes = appContext.reactContext!!.assets.open(MODEL_ASSET).use { it.readBytes() }
    env.createSession(bytes, OrtSession.SessionOptions())
  }

  override fun definition() = ModuleDefinition {
    Name("HrisFace")

    Function("supported") { true }

    // Hasil: { count, yaw, pitch, eyesOpen, size }. yaw/pitch derajat; eyesOpen 0..1
    // (terkecil dari dua mata, -1 bila tidak terbaca); size = lebar wajah / lebar foto.
    AsyncFunction("detect") { uri: String, promise: Promise ->
      try {
        val bmp = loadBitmap(uri)
        detector.process(InputImage.fromBitmap(bmp, 0))
          .addOnSuccessListener { faces ->
            val f = faces.maxByOrNull { it.boundingBox.width() }
            val left = f?.leftEyeOpenProbability
            val right = f?.rightEyeOpenProbability
            promise.resolve(
              mapOf(
                "count" to faces.size,
                "yaw" to (f?.headEulerAngleY?.toDouble() ?: 0.0),
                "pitch" to (f?.headEulerAngleX?.toDouble() ?: 0.0),
                "eyesOpen" to (if (left != null && right != null) minOf(left, right).toDouble() else -1.0),
                "size" to (if (f != null) f.boundingBox.width().toDouble() / bmp.width else 0.0)
              )
            )
          }
          .addOnFailureListener { e -> promise.reject("E_DETECT", e.message ?: "gagal", e) }
      } catch (e: Exception) {
        promise.reject("E_DETECT", e.message ?: "gagal", e)
      }
    }

    // Embedding 128 angka (sudah dinormalisasi L2) untuk wajah terbesar di foto,
    // atau null bila tidak ada wajah. Cosine antar embedding = hasil kali titik.
    AsyncFunction("embed") { uri: String, promise: Promise ->
      try {
        val bmp = loadBitmap(uri)
        detector.process(InputImage.fromBitmap(bmp, 0))
          .addOnSuccessListener { faces ->
            val f = faces.maxByOrNull { it.boundingBox.width() }
            if (f == null) {
              promise.resolve(null)
              return@addOnSuccessListener
            }
            try {
              val crop = alignFace(bmp, f)
              if (crop == null) promise.resolve(null) else promise.resolve(embedding(crop).toList())
            } catch (e: Exception) {
              promise.reject("E_EMBED", e.message ?: "gagal", e)
            }
          }
          .addOnFailureListener { e -> promise.reject("E_EMBED", e.message ?: "gagal", e) }
      } catch (e: Exception) {
        promise.reject("E_EMBED", e.message ?: "gagal", e)
      }
    }
  }

  // Foto dibaca dengan rotasi EXIF diterapkan dan sisi terpanjang <= 1280 px.
  private fun loadBitmap(uri: String): Bitmap {
    val path = Uri.parse(uri).path ?: uri
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1280) sample *= 2
    val raw = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
      ?: throw IllegalArgumentException("Foto tidak bisa dibaca")
    val degrees = when (ExifInterface(File(path).absolutePath).getAttributeInt(
      ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
    )) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (degrees == 0f) return raw
    val m = Matrix().apply { postRotate(degrees) }
    return Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, m, true)
  }

  // Meluruskan wajah ke templat 112x112 ArcFace dengan transformasi kemiripan
  // (skala + rotasi + geser) dari lima titik: dua mata, hidung, dua sudut mulut.
  private fun alignFace(bmp: Bitmap, f: Face): Bitmap? {
    fun pt(type: Int) = f.getLandmark(type)?.position
    val le = pt(FaceLandmark.LEFT_EYE)
    val re = pt(FaceLandmark.RIGHT_EYE)
    val nose = pt(FaceLandmark.NOSE_BASE)
    val ml = pt(FaceLandmark.MOUTH_LEFT)
    val mr = pt(FaceLandmark.MOUTH_RIGHT)
    if (le == null || re == null || nose == null || ml == null || mr == null) return null
    // Urutan templat memakai sisi kiri gambar lebih dulu: urutkan menurut x.
    val eyes = listOf(le, re).sortedBy { it.x }
    val mouth = listOf(ml, mr).sortedBy { it.x }
    val src = floatArrayOf(
      eyes[0].x, eyes[0].y, eyes[1].x, eyes[1].y, nose.x, nose.y, mouth[0].x, mouth[0].y, mouth[1].x, mouth[1].y
    )
    val m = similarity(src, TEMPLATE)
    val out = Bitmap.createBitmap(INPUT, INPUT, Bitmap.Config.ARGB_8888)
    Canvas(out).drawBitmap(bmp, m, Paint(Paint.FILTER_BITMAP_FLAG))
    return out
  }

  // Kuadrat terkecil: x' = a*x - b*y + tx ; y' = b*x + a*y + ty.
  private fun similarity(src: FloatArray, dst: FloatArray): Matrix {
    val n = src.size / 2
    var mx = 0.0; var my = 0.0; var mu = 0.0; var mv = 0.0
    for (i in 0 until n) { mx += src[2 * i]; my += src[2 * i + 1]; mu += dst[2 * i]; mv += dst[2 * i + 1] }
    mx /= n; my /= n; mu /= n; mv /= n
    var num1 = 0.0; var num2 = 0.0; var den = 0.0
    for (i in 0 until n) {
      val x = src[2 * i] - mx; val y = src[2 * i + 1] - my
      val u = dst[2 * i] - mu; val v = dst[2 * i + 1] - mv
      num1 += x * u + y * v
      num2 += x * v - y * u
      den += x * x + y * y
    }
    val a = num1 / den
    val b = num2 / den
    val tx = mu - a * mx + b * my
    val ty = mv - b * mx - a * my
    return Matrix().apply {
      setValues(floatArrayOf(a.toFloat(), (-b).toFloat(), tx.toFloat(), b.toFloat(), a.toFloat(), ty.toFloat(), 0f, 0f, 1f))
    }
  }

  // SFace: RGB 0..255 tanpa normalisasi, NCHW 1x3x112x112, keluaran 128 angka.
  private fun embedding(face: Bitmap): FloatArray {
    val px = IntArray(INPUT * INPUT)
    face.getPixels(px, 0, INPUT, 0, 0, INPUT, INPUT)
    val data = FloatArray(3 * INPUT * INPUT)
    val plane = INPUT * INPUT
    for (i in px.indices) {
      val p = px[i]
      data[i] = ((p shr 16) and 0xFF).toFloat()
      data[plane + i] = ((p shr 8) and 0xFF).toFloat()
      data[2 * plane + i] = (p and 0xFF).toFloat()
    }
    OnnxTensor.createTensor(env, FloatBuffer.wrap(data), longArrayOf(1, 3, INPUT.toLong(), INPUT.toLong())).use { input ->
      session.run(mapOf(session.inputNames.first() to input)).use { result ->
        @Suppress("UNCHECKED_CAST")
        val raw = (result[0].value as Array<FloatArray>)[0]
        var norm = 0.0
        for (v in raw) norm += v * v
        val inv = (1.0 / sqrt(norm)).toFloat()
        return FloatArray(raw.size) { raw[it] * inv }
      }
    }
  }

  companion object {
    private const val MODEL_ASSET = "face_recognition_sface_2021dec.onnx"
    private const val INPUT = 112
    private val TEMPLATE = floatArrayOf(
      38.2946f, 51.6963f, 73.5318f, 51.5014f, 56.0252f, 71.7366f, 41.5493f, 92.3655f, 70.7299f, 92.2041f
    )
  }
}
