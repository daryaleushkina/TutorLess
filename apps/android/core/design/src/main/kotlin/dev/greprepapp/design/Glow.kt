package dev.greprepapp.design

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
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
    private var paintDensity = Float.NaN

    fun draw(
        canvas: Canvas,
        size: Size,
        density: Float,
    ) {
        if (canvas.isHardwareAccelerated && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (paintDensity != density) {
                // Прозрачная заливка: под кнопкой рисуется только цветная тень, без второй поверхности.
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
            canvas.drawBitmap(layer.image.asAndroidBitmap(), layer.origin.x, layer.origin.y, null)
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
        val blur = shadow.blur.value * density
        val spread = shadow.spread.value * density
        val padding = ceil(blur * 2).toInt()
        val bitmap =
            Bitmap.createBitmap(
                ceil(size.width).toInt() + padding * 2,
                ceil(size.height).toInt() + padding * 2,
                Bitmap.Config.ARGB_8888,
            )
        val mask =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = shadow.color.toArgb()
                maskFilter = BlurMaskFilter(blur, BlurMaskFilter.Blur.NORMAL)
            }
        val radius = (size.height / 2 + spread).coerceAtLeast(0f)
        Canvas(
            bitmap,
        ).drawRoundRect(
            padding - spread,
            padding - spread,
            padding + size.width + spread,
            padding + size.height + spread,
            radius,
            radius,
            mask,
        )
        return GlowLayer(bitmap.asImageBitmap(), Offset(shadow.offsetX.value * density - padding, shadow.offsetY.value * density - padding))
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
private object RasterCache : LruCache<GlowKey, GlowLayer>(4 * 1024 * 1024) {
    override fun sizeOf(
        key: GlowKey,
        value: GlowLayer,
    ): Int = value.image.asAndroidBitmap().allocationByteCount
}

internal data class GlowLayer(
    val image: ImageBitmap,
    val origin: Offset,
)
