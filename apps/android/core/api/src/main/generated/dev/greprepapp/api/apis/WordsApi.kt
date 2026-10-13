package dev.greprepapp.api.apis

import dev.greprepapp.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import dev.greprepapp.api.models.Error
import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.Word
import dev.greprepapp.api.models.WordList

interface WordsApi {
    /**
     * GET api/words/{wordId}
     * Карточка одобренного слова своего экзамена
     * Платное содержимое доступно через права тренировок. Неодобренное слово, слово другого экзамена или неизвестный id — 404. Экзамен передаётся явно. Незаполненные поля отсутствуют, массивы могут быть пустыми.
     * Responses:
     *  - 200: Карточка слова
     *  - 0: Любая ошибка — машинный код, текст для журнала, id запроса
     *
     * @param wordId 
     * @param exam 
     * @return [Word]
     */
    @GET("api/words/{wordId}")
    suspend fun getWord(@Path("wordId") wordId: kotlin.String, @Query("exam") exam: Exam): Response<Word>

    /**
     * GET api/words
     * Одобренные слова экзамена по рейтингу
     * Доступ через те же права, что у тренировок; без прав — 403 до чтения слов. Поиск по началу lemma без учёта регистра, пробелы по краям q удаляются. Порядок — rank, затем id. Курсор связан с exam и q; при изменении поиска начать без after. Неизвестный exam, неверный limit или курсор — 400 bad_request.
     * Responses:
     *  - 200: Страница слов; отсутствие nextCursor означает конец списка
     *  - 0: Любая ошибка — машинный код, текст для журнала, id запроса
     *
     * @param exam 
     * @param q  (optional)
     * @param limit  (optional, default to 50)
     * @param after  (optional)
     * @return [WordList]
     */
    @GET("api/words")
    suspend fun getWords(@Query("exam") exam: Exam, @Query("q") q: kotlin.String? = null, @Query("limit") limit: kotlin.Int? = 50, @Query("after") after: kotlin.String? = null): Response<WordList>

}
