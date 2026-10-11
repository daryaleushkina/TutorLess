package dev.greprepapp.design

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import greprep.design.GpDarkTheme
import greprep.design.GpLightTheme
import greprep.design.GpShadow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
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
    @Config(sdk = [26, 27, 37])
    @GraphicsMode(GraphicsMode.Mode.LEGACY)
    fun rasterDrawsReuseTheDestinationRectangleForHardwareAndSoftwareCanvases() {
        val renderer = GlowRenderer(GpDarkTheme.glow)
        val size = Size(300f, 52f)
        val canvas = RecordingCanvas()
        if (android.os.Build.VERSION.SDK_INT >= 28) canvas.hardware = false
        renderer.draw(canvas, size, 2f)
        val destination = canvas.destination
        renderer.draw(canvas, size, 2f)
        assertSame(destination, canvas.destination)
        GlowRenderer(GpDarkTheme.glow).draw(canvas, size, 2f)
        assertSame(destination, canvas.destination)
        renderer.draw(canvas, Size(301f, 52f), 2f)
        assertNotSame(destination, canvas.destination)
    }

    @Test
    fun largeDenseButtonFitsInTheRasterCache() {
        val size = Size(4160f, 208f)
        val layer = GlowRenderer(GpDarkTheme.glow).layer(size, 4f)
        assertTrue(layer.image.width * layer.image.height * 4 <= 4 * 1024 * 1024)
        assertSame(layer, GlowRenderer(GpDarkTheme.glow).layer(size, 4f))
    }

    @Test
    @Config(sdk = [26, 27])
    @GraphicsMode(GraphicsMode.Mode.LEGACY)
    fun oldHardwareCanvasDrawsTheCachedRasterInsteadOfAShadow() {
        val canvas = RecordingCanvas()
        GlowRenderer(GpDarkTheme.glow).draw(canvas, Size(300f, 52f), 2f)
        assertEquals(1, canvas.bitmaps)
        assertTrue(canvas.left.isNaN())
    }

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
        val token = GpDarkTheme.glow
        val shadow = GpShadow(token.color, 3.dp, token.offsetY, token.blur, token.spread)
        assertTrue(token.color.alpha > 0f && token.color.alpha < 1f)
        assertTrue(GpLightTheme.glow.color.alpha > 0f && GpLightTheme.glow.color.alpha < 1f)
        GlowRenderer(shadow).draw(canvas, Size(300f, 52f), 2f)
        assertEquals(0, canvas.bitmaps)
        assertEquals(-shadow.spread.value * 2, canvas.left, 0f)
        assertEquals(300f + shadow.spread.value * 2, canvas.right, 0f)
        assertEquals(shadow.blur.value * 2, canvas.radius, 0f)
        assertEquals(shadow.offsetY.value * 2, canvas.offsetY, 0f)
        assertEquals(shadow.color.toArgb(), canvas.shadowColor)
        assertEquals(android.graphics.Color.TRANSPARENT, canvas.paintColor)
        assertEquals(shadow.offsetX.value * 2, canvas.offsetX, 0f)
    }

    private class RecordingCanvas : Canvas() {
        var bitmaps = 0
        var hardware = true
        var destination: RectF? = null
        var left = Float.NaN
        var right = Float.NaN
        var radius = Float.NaN
        var offsetY = Float.NaN
        var shadowColor = 0
        var paintColor = 0
        var offsetX = Float.NaN

        override fun isHardwareAccelerated(): Boolean = hardware

        override fun drawBitmap(
            bitmap: Bitmap,
            src: Rect?,
            dst: RectF,
            paint: Paint?,
        ) {
            bitmaps++
            destination = dst
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
            paintColor = paint.color
            offsetX = captured.shadowDx
        }
    }
}
