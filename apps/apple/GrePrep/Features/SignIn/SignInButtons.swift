import AuthenticationServices
import SwiftUI

/// Кнопки входа — официального вида каждой компании, свои стили к ним не применяются (DESIGN.md, «Правило
/// официальных кнопок»). Цвета — токены signIn*, логотипы — фигуры из файлов компаний (Design/SignInLogos.swift).

/// Размеры из правил самих компаний, а не из нашей системы: они меняются вместе с правилами, не с токенами.
private enum OfficialSpec {
    /// Google Identity: «G» 18, текст 14 Medium с трекингом 0,25.
    static let googleLogo: CGFloat = 18
}

/// «Вход с Apple» — родная кнопка Apple: чёрная в светлой теме, белая в тёмной.
/// Подпись рисует Apple; применить к ней токен GPSignInApple нельзя.
struct AppleSignInButton: View {
    let model: SignInModel
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        #if os(macOS)
            // На Mac обёртка SwiftUI держит свой размер и не растягивается до соседних кнопок, поэтому — сама
            // кнопка Apple (ASAuthorizationAppleIDButton) с высотой и скруглением как у остальных.
            MacAppleIDButton(model: model, style: colorScheme == .dark ? .white : .black)
                .frame(maxWidth: .infinity, minHeight: GPSize.button, maxHeight: GPSize.button)
                .accessibilityIdentifier("signin.apple")
        #else
            SignInWithAppleButton(.signIn) { request in
                model.prepareAppleRequest(request)
            } onCompletion: { result in
                Task { await model.completeApple(result) }
            }
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            .id(colorScheme)
            .frame(height: GPSize.button)
            .clipShape(Capsule())
            .accessibilityIdentifier("signin.apple")
        #endif
    }
}

#if os(macOS)
    import AppKit

    private struct MacAppleIDButton: NSViewRepresentable {
        let model: SignInModel
        let style: ASAuthorizationAppleIDButton.Style

        func makeCoordinator() -> AppleAuthorization { AppleAuthorization(model: model) }

        func makeNSView(context: Context) -> AppleButtonContainer {
            let container = AppleButtonContainer()
            container.update(style: style, enabled: context.environment.isEnabled, authorization: context.coordinator)
            return container
        }

        func updateNSView(_ container: AppleButtonContainer, context: Context) {
            context.coordinator.model = model
            container.update(style: style, enabled: context.environment.isEnabled, authorization: context.coordinator)
        }

        /// Своего размера кнопка не навязывает: берёт ширину колонки и высоту соседних кнопок входа.
        func sizeThatFits(_ proposal: ProposedViewSize, nsView: AppleButtonContainer, context: Context)
            -> CGSize?
        {
            CGSize(width: proposal.width ?? GPLayout.authColumnMax, height: GPSize.button)
        }
    }

    private final class AppleButtonContainer: NSView {
        private var style: ASAuthorizationAppleIDButton.Style?
        private var button: ASAuthorizationAppleIDButton?

        func update(style: ASAuthorizationAppleIDButton.Style, enabled: Bool, authorization: AppleAuthorization) {
            // AppKit фиксирует стиль при создании; заменить только нативный контрол внутри той же обёртки.
            if self.style != style {
                button?.removeFromSuperview()
                let newButton = ASAuthorizationAppleIDButton(
                    authorizationButtonType: .signIn, authorizationButtonStyle: style)
                newButton.cornerRadius = GPSize.button / 2
                newButton.frame = bounds
                newButton.autoresizingMask = [.width, .height]
                addSubview(newButton)
                button = newButton
                self.style = style
            }
            button?.target = authorization
            button?.action = #selector(AppleAuthorization.start)
            // Нативный контрол не видит SwiftUI .disabled.
            button?.isEnabled = enabled
        }
    }

    /// Окно входа Apple без обёртки SwiftUI: запрос — от модели (nonce), ответ — в модель.
    @MainActor
    private final class AppleAuthorization: NSObject, ASAuthorizationControllerDelegate,
        ASAuthorizationControllerPresentationContextProviding
    {
        var model: SignInModel

        init(model: SignInModel) {
            self.model = model
        }

        @objc func start() {
            // Один вход за раз (как у остальных кнопок — SignInModel.begin).
            guard model.busy == nil else { return }
            let request = ASAuthorizationAppleIDProvider().createRequest()
            model.prepareAppleRequest(request)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }

        nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
            MainActor.assumeIsolated { NSApp.keyWindow ?? NSWindow() }
        }

        nonisolated func authorizationController(
            controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization
        ) {
            MainActor.assumeIsolated {
                let model = model
                Task { await model.completeApple(.success(authorization)) }
            }
        }

        nonisolated func authorizationController(
            controller: ASAuthorizationController, didCompleteWithError error: any Error
        ) {
            MainActor.assumeIsolated {
                let model = model
                Task { await model.completeApple(.failure(error)) }
            }
        }
    }
#endif

/// Кнопка Google: белая с рамкой, цветная «G» (правила Google Identity).
struct GoogleSignInButton: View {
    let isBusy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: GPSpace.s10) {
                if isBusy {
                    ProgressView()
                } else {
                    GoogleGLogo()
                        .frame(width: OfficialSpec.googleLogo, height: OfficialSpec.googleLogo)
                        .accessibilityHidden(true)
                }
                Text("Войти с аккаунтом Google")
                    .font(.googleSignIn)
                    .tracking(GPSignInGoogle.tracking)
                    .frame(minHeight: GPSignInGoogle.lineHeight)
            }
            .foregroundStyle(Color(.signInGoogleText))
            .frame(maxWidth: .infinity, minHeight: GPSize.button)
            .padding(.horizontal, GPSpace.s12)
            .background(Color(.signInGoogleBg), in: Capsule())
            .overlay(Capsule().strokeBorder(Color(.signInGoogleStroke), lineWidth: GPSize.hairline))
            .contentShape(Capsule())
        }
        .buttonStyle(PressScaleStyle())
        .accessibilityIdentifier("signin.google")
    }
}
