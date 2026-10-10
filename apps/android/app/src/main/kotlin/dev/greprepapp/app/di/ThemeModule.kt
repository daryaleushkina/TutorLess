package dev.greprepapp.app.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dev.greprepapp.app.core.theme.AndroidThemeModeApplier
import dev.greprepapp.app.core.theme.ThemeModeApplier

@Module
@InstallIn(SingletonComponent::class)
abstract class ThemeModule {
    @Binds
    abstract fun themeMode(applier: AndroidThemeModeApplier): ThemeModeApplier
}
