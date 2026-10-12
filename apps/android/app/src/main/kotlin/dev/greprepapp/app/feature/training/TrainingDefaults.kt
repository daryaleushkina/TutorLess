package dev.greprepapp.app.feature.training

internal object TrainingDefaults {
    const val PRACTICE_QUESTIONS = 10

    /** Первая секция GRE; серверный набор секции имеет приоритет. */
    const val GRE_SECTION_QUESTIONS = 12
}

object QuestionReportLimits {
    /** QuestionReport.text.maxLength: символы Unicode, не кодовые единицы UTF-16. */
    const val TEXT_CODE_POINTS = 2000
}
