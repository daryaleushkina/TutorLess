package dev.greprepapp.app.feature.shell

import dev.greprepapp.api.ApiJson
import dev.greprepapp.api.models.ExamInfo
import dev.greprepapp.api.models.Home
import dev.greprepapp.api.models.TrainingOptions
import dev.greprepapp.api.models.User
import dev.greprepapp.app.core.report.ClientErrorReporter
import dev.greprepapp.app.core.session.PersonalData
import kotlinx.serialization.Serializable
import java.io.File
import java.security.MessageDigest

@Serializable
data class CachedHome(
    val home: Home,
    val options: TrainingOptions,
)

@Serializable
data class CachedShell(
    val owner: String,
    val credentialHash: String,
    val user: User? = null,
    val exams: List<ExamInfo> = emptyList(),
    val homes: Map<String, CachedHome> = emptyMap(),
)

/** Кэш главной привязан к подтверждённому владельцу и токену; чужой вход не читает его даже без сети. */
class ShellCache(
    directory: File,
    private val reporter: ClientErrorReporter,
) : PersonalData {
    private val file = File(directory, "shell.json")
    private var value: CachedShell? = null
    private var loaded = false

    @Synchronized
    fun load(credential: String): CachedShell? {
        read()
        return value?.takeIf { it.credentialHash == hash(credential) }
    }

    @Synchronized
    override fun isConnected(credential: String): Boolean = load(credential) != null

    @Synchronized
    override fun connect(
        ownerId: String,
        credential: String,
    ): String? {
        read()
        val old = value?.takeIf { it.owner == ownerId }
        save(old?.copy(credentialHash = hash(credential)) ?: CachedShell(ownerId, hash(credential)))
        return null
    }

    @Synchronized
    fun save(next: CachedShell) {
        val tmp = File(file.parentFile, "shell.json.tmp")
        tmp.writeText(ApiJson.encodeToString(CachedShell.serializer(), next))
        if (!tmp.renameTo(file)) throw java.io.IOException("shell cache rename failed")
        value = next
        loaded = true
    }

    private fun read() {
        if (loaded) return
        loaded = true
        if (!file.exists()) return
        try {
            value = ApiJson.decodeFromString(CachedShell.serializer(), file.readText())
        } catch (failure: java.io.IOException) {
            loaded = false
            reporter.report("shell cache read failed: ${failure.javaClass.simpleName}", route = "shell")
        } catch (failure: kotlinx.serialization.SerializationException) {
            reporter.report("shell cache unreadable: ${failure.javaClass.simpleName}", route = "shell")
        } catch (failure: IllegalArgumentException) {
            reporter.report("shell cache invalid: ${failure.javaClass.simpleName}", route = "shell")
        }
    }

    @Synchronized
    override fun clear() {
        value = null
        loaded = true
        if (file.exists() && !file.delete()) file.writeText("")
    }

    private fun hash(credential: String): String =
        MessageDigest.getInstance("SHA-256").digest(credential.toByteArray()).joinToString("") { "%02x".format(it) }
}
