package dev.greprepapp.app.testing

import dev.greprepapp.api.apis.TrainingsApi
import dev.greprepapp.api.models.Exam
import dev.greprepapp.api.models.QuestionType
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FakeTrainingsApiTest {
    @Test
    fun `home is available through the generated interface`() =
        runTest {
            val fake = FakeTrainingsApi()
            val api: TrainingsApi = fake
            val types = listOf(QuestionType.MULTIPLE_CHOICE)
            val response = api.getHome(Exam.GRE, "UTC", types)

            assertTrue(response.isSuccessful)
            val home = response.body()
            assertNotNull(home)
            assertEquals(0, home?.week?.answers)
            assertEquals(0, home?.week?.days)
            assertEquals(0, home?.week?.minutes)
            assertEquals(listOf(Triple(Exam.GRE, "UTC", types)), fake.homeCalls)
        }
}
