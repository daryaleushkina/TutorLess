package dev.greprepapp.app.snapshots

import dev.greprepapp.api.models.ActiveExam
import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.ExamInfo
import dev.greprepapp.api.models.Home
import dev.greprepapp.api.models.LastTraining
import dev.greprepapp.api.models.Section
import dev.greprepapp.api.models.SectionStats
import dev.greprepapp.api.models.WeekStats
import dev.greprepapp.app.feature.shell.ShellState
import dev.greprepapp.app.testing.Fixtures
import dev.greprepapp.app.testing.session

object ShellFixtures {
    val first =
        ShellState(
            user =
                session().user.copy(
                    name = "Алина Карпова",
                    activeExam = ActiveExam.GRE,
                    identities =
                        listOf(
                            dev.greprepapp.api.models
                                .LinkedIdentity(dev.greprepapp.api.models.IdentityProvider.APPLE, "2026-10-12T00:00:00Z"),
                        ),
                ),
            exams =
                listOf(
                    ExamInfo(Exam.GRE, listOf(Section.VERBAL, Section.QUANT, Section.ESSAY)),
                    ExamInfo(Exam.TOEFL, listOf(Section.READING, Section.LISTENING, Section.WRITING, Section.SPEAKING)),
                ),
            home = Home(null, emptyList(), 0, null, WeekStats(0, 0, 0)),
            options = Fixtures.options(emptyList()),
            loading = false,
        )
    val history =
        first.copy(
            home =
                Home(
                    LastTraining(Fixtures.timedPreset.request.copy(mode = dev.greprepapp.api.models.TrainingMode.PRACTICE), 10),
                    listOf(SectionStats(Section.VERBAL, 25, 17), SectionStats(Section.QUANT, 50, 37)),
                    12,
                    dev.greprepapp.api.models
                        .WeakSpot(dev.greprepapp.api.models.QuestionType.SENTENCE_EQUIVALENCE, Section.VERBAL, 38.0),
                    WeekStats(3, 42, 38),
                ),
        )
    val toefl = first.copy(user = first.user!!.copy(activeExam = ActiveExam.TOEFL), options = first.options!!.copy(types = emptyList()))
}
