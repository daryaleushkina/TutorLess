package dev.greprepapp.app.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dev.greprepapp.app.ui.ActivityContentInstaller
import dev.greprepapp.app.ui.ComposeActivityContentInstaller

@Module
@InstallIn(SingletonComponent::class)
abstract class ContentModule {
    @Binds
    abstract fun activityContent(installer: ComposeActivityContentInstaller): ActivityContentInstaller
}
