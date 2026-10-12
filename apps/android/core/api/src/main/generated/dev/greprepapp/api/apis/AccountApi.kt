package dev.greprepapp.api.apis

import dev.greprepapp.api.infrastructure.CollectionFormats.*
import retrofit2.http.*
import retrofit2.Response
import okhttp3.RequestBody
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

import dev.greprepapp.api.models.Error
import dev.greprepapp.api.models.ExamChoice
import dev.greprepapp.api.models.LocaleChoice
import dev.greprepapp.api.models.User

interface AccountApi {
    /**
     * GET api/me
     * Кто вошёл
     * 
     * Responses:
     *  - 200: Пользователь
     *  - 0: Любая ошибка — машинный код, текст для журнала, id запроса
     *
     * @return [User]
     */
    @GET("api/me")
    suspend fun getMe(): Response<User>

    /**
     * PUT api/me/exam
     * Выбрать активный экзамен аккаунта (решение Даши 09.10.2026)
     * 
     * Responses:
     *  - 200: Пользователь с выбранным экзаменом
     *  - 0: Любая ошибка — машинный код, текст для журнала, id запроса
     *
     * @param examChoice 
     * @return [User]
     */
    @PUT("api/me/exam")
    suspend fun setActiveExam(@Body examChoice: ExamChoice): Response<User>

    /**
     * PUT api/me/locale
     * Сменить язык аккаунта для всех устройств
     * 
     * Responses:
     *  - 200: Пользователь с выбранным языком (тот же ответ, что GET /api/me)
     *  - 0: Любая ошибка — машинный код, текст для журнала, id запроса
     *
     * @param localeChoice 
     * @return [User]
     */
    @PUT("api/me/locale")
    suspend fun setLocale(@Body localeChoice: LocaleChoice): Response<User>

}
