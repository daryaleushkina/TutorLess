package dev.greprepapp.app.feature.signin

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import dev.greprepapp.app.R
import dev.greprepapp.design.Gp
import greprep.design.GpSignInApple
import greprep.design.GpSignInGoogle
import greprep.design.GpSize
import greprep.design.GpSpace

/*
 * Кнопка Apple — системный шрифт платформы, как на вебе и Apple (решение 10.10.2026).
 * Официальная типографика — в токенах; Google требует Roboto Medium, в том числе на Samsung.
 */
private val Roboto = FontFamily(Font(R.font.roboto_medium, GpSignInGoogle.fontWeight))
private val AppleText =
    TextStyle(
        fontFamily = GpSignInApple.fontFamily,
        fontSize = GpSignInApple.fontSize,
        lineHeight = GpSignInApple.lineHeight,
        fontWeight = GpSignInApple.fontWeight,
    )
private val GoogleText =
    TextStyle(
        fontFamily = Roboto,
        fontSize = GpSignInGoogle.fontSize,
        lineHeight = GpSignInGoogle.lineHeight,
        fontWeight = GpSignInGoogle.fontWeight,
        letterSpacing = GpSignInGoogle.tracking,
    )

/** «Вход с Apple»: только чёрная (светлая тема) или белая (тёмная). */
@Composable
fun AppleSignInButton(
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val colors = Gp.colors
    ProviderButton(
        text = stringResource(R.string.signin_apple),
        textStyle = AppleText,
        logo = R.drawable.ic_logo_apple,
        logoTint = colors.signInAppleText,
        container = colors.signInAppleBg,
        content = colors.signInAppleText,
        border = null,
        busy = busy,
        enabled = enabled,
        onClick = onClick,
        tag = "signin.apple",
    )
}

/** Google: белая с рамкой (светлая тема) или тёмная, «G» всегда цветная. */
@Composable
fun GoogleSignInButton(
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val colors = Gp.colors
    ProviderButton(
        text = stringResource(R.string.signin_google),
        textStyle = GoogleText,
        logo = R.drawable.ic_logo_google,
        logoTint = null,
        container = colors.signInGoogleBg,
        content = colors.signInGoogleText,
        border = BorderStroke(GpSize.hairline, colors.signInGoogleStroke),
        busy = busy,
        enabled = enabled,
        onClick = onClick,
        tag = "signin.google",
    )
}

@Composable
private fun ProviderButton(
    text: String,
    textStyle: TextStyle,
    @DrawableRes logo: Int,
    logoTint: Color?,
    container: Color,
    content: Color,
    border: BorderStroke?,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    tag: String,
) {
    Button(
        onClick = onClick,
        // Пока идёт вход, кнопки не нажимаются, но не бледнеют: официальный вид не меняется.
        enabled = enabled,
        shape = CircleShape,
        border = border,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = container,
                contentColor = content,
                disabledContainerColor = container,
                disabledContentColor = content,
            ),
        // Высота — минимум, а не жёстко: при крупном шрифте подпись переносится и кнопка растёт, а не режет её.
        contentPadding = PaddingValues(horizontal = GpSpace.s12, vertical = GpSpace.s8),
        modifier = Modifier.fillMaxWidth().heightIn(min = GpSize.button).testTag(tag),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(GpSpace.s8),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.alpha(if (busy) 0f else 1f),
            ) {
                if (logoTint == null) {
                    Image(painter = painterResource(logo), contentDescription = null)
                } else {
                    Icon(painter = painterResource(logo), contentDescription = null, tint = logoTint)
                }
                Text(text = text, style = textStyle, textAlign = TextAlign.Center)
            }
            if (busy) CircularProgressIndicator(color = content, modifier = Modifier.size(GpSpace.s20))
        }
    }
}
