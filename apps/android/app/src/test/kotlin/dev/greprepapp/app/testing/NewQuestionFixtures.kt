package dev.greprepapp.app.testing

import dev.greprepapp.api.models.Explanation
import dev.greprepapp.api.models.LocalizedText
import dev.greprepapp.api.models.NumericAnswer
import dev.greprepapp.api.models.NumericEntry
import dev.greprepapp.api.models.OptionGroup
import dev.greprepapp.api.models.Passage
import dev.greprepapp.api.models.PassageParagraph
import dev.greprepapp.api.models.PassageSentence
import dev.greprepapp.api.models.QuestionOption
import dev.greprepapp.api.models.QuestionType
import dev.greprepapp.api.models.Section

/** Только тестовые состояния макетов R7–R11b; ожидания арифметики читаются из общих примеров договора. */
object NewQuestionFixtures {
    val passage =
        Passage(
            "deep-ocean",
            listOf(
                PassageParagraph(
                    listOf(
                        PassageSentence(
                            "s1",
                            "For decades, ecologists assumed that the deep ocean floor was nearly static, " +
                                "receiving only a slow drizzle of organic debris from the surface.",
                        ),
                        PassageSentence("s2", "Long-term camera studies have complicated that picture."),
                        PassageSentence(
                            "s3",
                            "At one site off California, researchers recorded sudden pulses of sinking material—so-called marine snow—" +
                                "that arrived within weeks of surface plankton blooms.",
                        ),
                    ),
                ),
                PassageParagraph(
                    listOf(
                        PassageSentence(
                            "s4",
                            "During these pulses, populations of sea cucumbers and other deposit feeders shifted noticeably, " +
                                "suggesting that the seafloor community responds to events far above it with surprising speed.",
                        ),
                        PassageSentence(
                            "s5",
                            "The findings do not mean that the abyss is as dynamic as a coastal reef; most of the time, change there remains slow.",
                        ),
                        PassageSentence(
                            "s6",
                            "But they imply that models treating the deep sea as a buffered, unchanging system may underestimate " +
                                "how quickly it reacts to warming at the surface.",
                        ),
                    ),
                ),
            ),
        )
    val rc =
        Fixtures.mc.copy(
            id = "00000000-0000-4000-8000-000000000031",
            section = Section.VERBAL,
            topicId = "reading-evidence",
            topicTitle = LocalizedText("Доказательства в тексте", "Evidence in passages"),
            prompt = "The passage suggests that the camera studies chiefly challenge which assumption?",
            passage = passage,
            groups =
                listOf(
                    OptionGroup(
                        listOf(
                            QuestionOption("A", "that marine snow reaches the seafloor only in winter"),
                            QuestionOption("B", "that the deep seafloor changes little over short periods"),
                            QuestionOption("C", "that deposit feeders depend on nearby coastal reefs"),
                            QuestionOption("D", "that plankton blooms are rare at the surface"),
                            QuestionOption("E", "that warming affects only the upper ocean"),
                        ),
                    ),
                ),
            answer = listOf("B"),
            explanation =
                Explanation(
                    LocalizedText(
                        "Камеры показали быстрые изменения. Это противоречит представлению о почти неизменном дне океана.",
                        "The cameras recorded rapid changes, challenging the assumption that the seafloor changes little.",
                    ),
                    emptyList(),
                ),
        )
    val sentence =
        rc.copy(
            id = "00000000-0000-4000-8000-000000000032",
            questionType = QuestionType.SELECT_IN_PASSAGE,
            prompt = "Select the sentence that limits how far the camera findings should be generalized.",
            groups = emptyList(),
            selectCount = 0,
            answer = listOf("s5"),
            explanation =
                Explanation(
                    LocalizedText(
                        "В пятом предложении автор уточняет: изменения на дне обычно остаются медленными.",
                        "The fifth sentence limits the conclusion: change on the seafloor usually remains slow.",
                    ),
                    emptyList(),
                ),
        )
    val multi =
        Fixtures.mc.copy(
            id = "00000000-0000-4000-8000-000000000033",
            questionType = QuestionType.MULTIPLE_CHOICE_MULTI,
            prompt = "x is an integer, and 3 < x² < 30. Which of the following could be the value of x?",
            groups =
                listOf(
                    OptionGroup(
                        listOf("−5", "−4", "−1", "2", "5", "6").mapIndexed {
                            i,
                            text,
                            ->
                            QuestionOption(('A' + i).toString(), text)
                        },
                    ),
                ),
            selectCount = 0,
            answer = listOf("A", "B", "D", "E"),
            topicId = "integer-properties",
            topicTitle = LocalizedText("Свойства целых чисел", "Integer properties"),
            explanation =
                Explanation(
                    LocalizedText(
                        "Из списка подходят −5, −4, 2 и 5: их квадраты больше 3 и меньше 30.",
                        "Of the listed values, −5, −4, 2, and 5 have squares greater than 3 and less than 30.",
                    ),
                    emptyList(),
                ),
        )
    val number =
        Fixtures.mc.copy(
            id = "00000000-0000-4000-8000-000000000034",
            questionType = QuestionType.NUMERIC_ENTRY,
            prompt = "A store sells pens for $1.25 each. How many dollars do 18 pens cost?",
            groups = emptyList(),
            selectCount = 0,
            answer = emptyList(),
            numericEntry = NumericEntry(NumericEntry.Format.NUMBER),
            numericAnswer = NumericAnswer(number = "22.50"),
            explanation = Explanation(LocalizedText("18 × 1,25 = 22,5 доллара.", "18 × 1.25 = 22.5 dollars."), emptyList()),
        )
    val fraction =
        number.copy(
            id = "00000000-0000-4000-8000-000000000035",
            prompt =
                "A bag holds 4 red, 6 blue, and 5 green marbles. One marble is drawn at random. " +
                    "What is the probability that it is not blue?",
            numericEntry = NumericEntry(NumericEntry.Format.FRACTION),
            numericAnswer = NumericAnswer(numerator = "3", denominator = "5"),
            explanation =
                Explanation(
                    LocalizedText("Не синих шаров 9 из 15: 9/15 = 3/5.", "9 of 15 marbles are not blue: 9/15 = 3/5."),
                    emptyList(),
                ),
        )
}
