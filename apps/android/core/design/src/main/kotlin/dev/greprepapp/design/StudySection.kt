package dev.greprepapp.design

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import greprep.design.GpColors

/** Раздел подготовки и его цвета: метка и мягкая подложка (DESIGN.md, «Цвета разделов»). */
enum class StudySection(
    @param:DrawableRes val icon: Int,
) {
    Verbal(R.drawable.ic_section_verbal),
    Quant(R.drawable.ic_section_quant),
    Words(R.drawable.ic_section_words),
    Essay(R.drawable.ic_section_essay),
    ;

    fun color(colors: GpColors): Color =
        when (this) {
            Verbal -> colors.verbal
            Quant -> colors.quant
            Words -> colors.words
            Essay -> colors.essay
        }

    fun soft(colors: GpColors): Color =
        when (this) {
            Verbal -> colors.verbalSoft
            Quant -> colors.quantSoft
            Words -> colors.wordsSoft
            Essay -> colors.essaySoft
        }
}

/** Плоский фон: единственный свет на экране принадлежит главной кнопке. */
@Composable
fun SectionBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier.fillMaxSize().background(Gp.colors.bg)) { content() }
}
