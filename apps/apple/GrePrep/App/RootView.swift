import SwiftUI

/// Вошёл человек — разделы, нет — экран входа.
struct RootView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch app.phase {
            case let .signedOut(reason):
                SignInView(app: app, reason: reason)
            case .signedIn:
                if let shell = app.shell {
                    ShellRootView(model: shell)
                }
            }
        }
        .tint(Color(.text))
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                app.retrySessionIfNeeded()
                app.trainings.sync()
                Task { await app.shell?.refresh() }
            }
        }
        .onChange(of: app.network.isOnline) { _, online in
            if online { app.trainings.sync() }
            // Главная обновляется и пока открыт другой раздел.
            Task { await app.shell?.networkChanged() }
        }
    }
}
