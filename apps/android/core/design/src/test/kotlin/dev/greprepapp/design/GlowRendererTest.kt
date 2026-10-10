package dev.greprepapp.design

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import greprep.design.GpDarkTheme
import greprep.design.GpLightTheme
import greprep.design.GpShadow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [26, 28, 31, 37])
class GlowRendererTest {
    @Test
    fun softwareLayersSurviveButtonDisposalAndAreKeyedByAllParameters() {
        val shadow = GpDarkTheme.glow
        val size = Size(300f, 52f)
        val original = GlowRenderer(shadow).layer(size, 1f)
        assertSame(original, GlowRenderer(shadow).layer(size, 1f))
        assertNotSame(original, GlowRenderer(shadow).layer(Size(301f, 52f), 1f))
        assertNotSame(original, GlowRenderer(shadow).layer(size, 2f))
        assertNotSame(original, GlowRenderer(GpLightTheme.glow).layer(size, 1f))
        val shifted = GpShadow(shadow.color, 1.dp, shadow.offsetY, shadow.blur, shadow.spread)
        assertNotSame(original, GlowRenderer(shifted).layer(size, 1f))
        val spread = GpShadow(shadow.color, shadow.offsetX, shadow.offsetY, shadow.blur, 1.dp)
        assertNotSame(original, GlowRenderer(spread).layer(size, 1f))
    }

    @Test
    @Config(sdk = [28, 31, 37])
    @GraphicsMode(GraphicsMode.Mode.LEGACY)
    fun hardwareCanvasUsesAShadowWithoutAllocatingABitmapAndPreservesSpread() {
        val canvas = RecordingCanvas()
        val shadow = GpDarkTheme.glow
        GlowRenderer(shadow).draw(canvas, Size(300f, 52f), 2f)
        assertEquals(0, canvas.bitmaps)
        assertEquals(-shadow.spread.value * 2, canvas.left, 0f)
        assertEquals(300f + shadow.spread.value * 2, canvas.right, 0f)
        assertEquals(shadow.blur.value * 2, canvas.radius, 0f)
        assertEquals(shadow.offsetY.value * 2, canvas.offsetY, 0f)
        assertEquals(shadow.color.toArgb(), canvas.shadowColor)
    }

    private class RecordingCanvas : Canvas() {
        var bitmaps = 0
        var left = Float.NaN
        var right = Float.NaN
        var radius = Float.NaN
        var offsetY = Float.NaN
        var shadowColor = 0

        override fun isHardwareAccelerated(): Boolean = true

        override fun drawBitmap(
            bitmap: Bitmap,
            left: Float,
            top: Float,
            paint: Paint?,
        ) {
            bitmaps++
        }

        override fun drawRoundRect(
            left: Float,
            top: Float,
            right: Float,
            bottom: Float,
            rx: Float,
            ry: Float,
            paint: Paint,
        ) {
            this.left = left
            this.right = right
            // Геттеры Paint доступны с API 29; аппаратный путь также проверяем на API 28.
            val captured = org.robolectric.Shadows.shadowOf(paint)
            radius = captured.shadowRadius
            offsetY = captured.shadowDy
            shadowColor = captured.shadowColor
        }
    }
}
