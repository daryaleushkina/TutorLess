package dev.greprepapp.app.feature.training

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import dev.greprepapp.design.Gp
import greprep.design.GpLayout
import greprep.design.GpSpace

/** Шторку, системную «Назад» и предиктивный возврат ведёт Material. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TrainingSheet(
    onDismiss: () -> Unit,
    tag: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Gp.colors.surface,
        contentColor = Gp.colors.text,
    ) {
        Column(
            Modifier
                .fillMaxWidth()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = GpLayout.gutter, vertical = GpSpace.s16)
                .testTag(tag),
            verticalArrangement = Arrangement.spacedBy(GpSpace.s16),
            content = content,
        )
    }
}
