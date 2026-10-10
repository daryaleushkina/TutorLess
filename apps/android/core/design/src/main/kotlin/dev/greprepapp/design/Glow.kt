package dev.greprepapp.design

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import greprep.design.GpShadow
import kotlin.math.ceil

/** Свечение только главного действия; у недоступной кнопки его нет (DESIGN.md, «Buttons»). */
@Composable
internal fun Modifier.primaryGlow(enabled: Boolean): Modifier {
    val shadow = Gp.theme.glow
    val renderer = remember(shadow) { GlowRenderer(shadow) }
    return if (!enabled) {
        this
    } else {
        drawBehind {
            val layer = renderer.layer(size, density)
            drawImage(layer.image, topLeft = layer.origin)
        }
    }
}

/**
 * Маска размывается в растровом слое один раз на размер/плотность: BlurMaskFilter на аппаратном Canvas
 * Android 8 не поддерживается. drawBehind затем рисует готовый слой и на API 26; spread меняет маску
 * перед размытием. Слой не обрезан границей кнопки и не пересчитывается при каждом кадре нажатия.
 */
internal class GlowRenderer(
    private val shadow: GpShadow,
) {
    private var cachedSize = Size.Unspecified
    private var cachedDensity = 0f
    private var cached: GlowLayer? = null

    fun layer(
        size: Size,
        density: Float,
    ): GlowLayer {
        cached?.let { if (cachedSize == size && cachedDensity == density) return it }
        val blur = shadow.blur.value * density
        val spread = shadow.spread.value * density
        val offsetX = shadow.offsetX.value * density
        val offsetY = shadow.offsetY.value * density
        val padding = ceil(blur * 2).toInt()
        val bitmap =
            Bitmap.createBitmap(
                ceil(size.width).toInt() + padding * 2,
                ceil(size.height).toInt() + padding * 2,
                Bitmap.Config.ARGB_8888,
            )
        val paint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = shadow.color.toArgb()
                maskFilter = BlurMaskFilter(blur, BlurMaskFilter.Blur.NORMAL)
            }
        val radius = (size.height / 2 + spread).coerceAtLeast(0f)
        Canvas(bitmap).drawRoundRect(
            padding - spread,
            padding - spread,
            padding + size.width + spread,
            padding + size.height + spread,
            radius,
            radius,
            paint,
        )
        return GlowLayer(bitmap.asImageBitmap(), Offset(offsetX - padding, offsetY - padding)).also {
            cachedSize = size
            cachedDensity = density
            cached = it
        }
    }
}

internal data class GlowLayer(
    val image: ImageBitmap,
    val origin: Offset,
)
