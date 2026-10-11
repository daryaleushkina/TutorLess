package dev.greprepapp.design

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.util.LruCache
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import greprep.design.GpShadow
import kotlin.math.ceil
import kotlin.math.sqrt

/** Свечение только главного действия; у недоступной кнопки его нет (DESIGN.md, «Buttons»). */
@Composable
internal fun Modifier.primaryGlow(enabled: Boolean): Modifier {
    val shadow = Gp.theme.glow
    val renderer = remember(shadow) { GlowRenderer(shadow) }
    return if (!enabled) this else drawBehind { drawIntoCanvas { renderer.draw(it.nativeCanvas, size, density) } }
}

/** Аппаратная тень не создаёт растр кнопки; программный Canvas и API 26–27 используют общий кэш. */
internal class GlowRenderer(
    private val shadow: GpShadow,
) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val bitmapPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private var paintDensity = Float.NaN

    fun draw(
        canvas: Canvas,
        size: Size,
        density: Float,
    ) {
        if (canvas.isHardwareAccelerated && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (paintDensity != density) {
                // У полупрозрачного shadowColor своя alpha, независимая от прозрачной заливки
                // (Paint.setShadowLayer). HWUI применяет BlurDrawLooper до отрисовки исходной формы.
                paint.color = android.graphics.Color.TRANSPARENT
                paint.setShadowLayer(
                    shadow.blur.value * density,
                    shadow.offsetX.value * density,
                    shadow.offsetY.value * density,
                    shadow.color.toArgb(),
                )
                paintDensity = density
            }
            val spread = shadow.spread.value * density
            val radius = (size.height / 2 + spread).coerceAtLeast(0f)
            canvas.drawRoundRect(-spread, -spread, size.width + spread, size.height + spread, radius, radius, paint)
        } else {
            val layer = layer(size, density)
            canvas.drawBitmap(
                layer.image.asAndroidBitmap(),
                null,
                layer.destination,
                bitmapPaint,
            )
        }
    }

    fun layer(
        size: Size,
        density: Float,
    ): GlowLayer {
        val key =
            GlowKey(
                size,
                density,
                shadow.color.toArgb(),
                shadow.offsetX.value,
                shadow.offsetY.value,
                shadow.blur.value,
                shadow.spread.value,
            )
        // LruCache синхронизирует сам доступ, а один блок не даёт двум Canvas размыть один размер дважды.
        return synchronized(RasterCache) {
            RasterCache.get(key) ?: raster(size, density).also { RasterCache.put(key, it) }
        }
    }

    private fun raster(
        size: Size,
        density: Float,
    ): GlowLayer {
        // Размытый слой не содержит мелких деталей. Половинный растр дешевле в четыре раза;
        // особо большие размеры уменьшаем ещё, чтобы один слой не вытеснил весь кэш.
        val fullPadding = shadow.blur.value * density * 2
        val fullBytes = (size.width + fullPadding * 2) * (size.height + fullPadding * 2) * 4
        val scale = minOf(0.5f, sqrt((RASTER_CACHE_BYTES / 4f) / fullBytes))
        val scaledSize = size * scale
        val blur = shadow.blur.value * density * scale
        val spread = shadow.spread.value * density * scale
        val padding = ceil(blur * 2).toInt()
        val bitmap =
            Bitmap.createBitmap(
                ceil(scaledSize.width).toInt() + padding * 2,
                ceil(scaledSize.height).toInt() + padding * 2,
                Bitmap.Config.ARGB_8888,
            )
        val mask =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = shadow.color.toArgb()
                maskFilter = BlurMaskFilter(blur, BlurMaskFilter.Blur.NORMAL)
            }
        val radius = (scaledSize.height / 2 + spread).coerceAtLeast(0f)
        Canvas(
            bitmap,
        ).drawRoundRect(
            padding - spread,
            padding - spread,
            padding + scaledSize.width + spread,
            padding + scaledSize.height + spread,
            radius,
            radius,
            mask,
        )
        return GlowLayer(
            bitmap.asImageBitmap(),
            Offset(shadow.offsetX.value * density - padding / scale, shadow.offsetY.value * density - padding / scale),
            Size(bitmap.width / scale, bitmap.height / scale),
        )
    }
}

private data class GlowKey(
    val size: Size,
    val density: Float,
    val color: Int,
    val offsetX: Float,
    val offsetY: Float,
    val blur: Float,
    val spread: Float,
)

// Ограничение памяти, не токен вида: кэш переживает уход кнопки из LazyColumn, но не держит все размеры.
private const val RASTER_CACHE_BYTES = 4 * 1024 * 1024

private object RasterCache : LruCache<GlowKey, GlowLayer>(RASTER_CACHE_BYTES) {
    override fun sizeOf(
        key: GlowKey,
        value: GlowLayer,
    ): Int = value.image.asAndroidBitmap().allocationByteCount
}

internal data class GlowLayer(
    val image: ImageBitmap,
    val origin: Offset,
    val size: Size,
) {
    // Размер и смещение слоя неизменны: Canvas повторно использует прямоугольник из кэша.
    val destination = RectF(origin.x, origin.y, origin.x + size.width, origin.y + size.height)
}
