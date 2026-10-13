import SnapshotTesting
import SwiftUI
import Vision

@testable import GrePrep

#if os(iOS)
    import UIKit
#endif

/// Один живой экран: повторное чтение снимка проверяет обновление T6, не пересоздавая тренировку.
@MainActor
final class TrainingScreenProbe {
    private struct Screen: View {
        let shell: ShellModel
        let session: SessionModel
        var body: some View {
            NavigationStack { TrainingSessionView(model: session, keyboardAvailable: false) }
                .environment(\.gpTrainingOffline, shell.staleProblem == .offline)
                .environment(\.locale, Locale(identifier: shell.locale.rawValue))
                .gpDesignTokens()
        }
    }

    #if os(iOS)
        private let controller: UIHostingController<Screen>
    #else
        private let controller: NSHostingController<Screen>
    #endif

    init(shell: ShellModel, session: SessionModel) {
        let view = Screen(shell: shell, session: session)
        #if os(iOS)
            controller = UIHostingController(rootView: view)
        #else
            controller = NSHostingController(rootView: view)
        #endif
    }

    func showsOfflineNotice() async throws -> Bool {
        let size = CGSize(width: 402, height: 874)
        #if os(iOS)
            let strategy = Snapshotting<UIViewController, UIImage>.image(size: size)
            let image: UIImage = await withCheckedContinuation { continuation in
                strategy.snapshot(controller).run { continuation.resume(returning: $0) }
            }
            guard let cgImage = image.cgImage else { throw APIFailure.unexpected("training probe: no image") }
        #else
            let strategy = Snapshotting<NSViewController, NSImage>.image(size: size)
            let image: NSImage = await withCheckedContinuation { continuation in
                strategy.snapshot(controller).run { continuation.resume(returning: $0) }
            }
            guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                throw APIFailure.unexpected("training probe: no image")
            }
        #endif
        let request = VNRecognizeTextRequest()
        request.recognitionLanguages = ["ru-RU", "en-US"]
        try VNImageRequestHandler(cgImage: cgImage).perform([request])
        return (request.results ?? []).contains { $0.topCandidates(1).first?.string.contains("Нет сети") == true }
    }
}
