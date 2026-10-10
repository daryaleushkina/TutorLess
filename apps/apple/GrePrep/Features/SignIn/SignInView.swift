import AuthenticationServices
import SwiftUI

/// Экран входа (макет T4-SignIn): знак, имя, одна фраза о продукте и два равноценных способа
/// входа — Apple и Google (решение Даши 10.10.2026). Дисклеймер ETS — на стартовом экране каждого
/// приложения (PRODUCT.md, «Brand Commitments»).
struct SignInView: View {
    let reason: AppModel.SignOutReason?
    /// Вход подменой виден только в отладочной сборке; снимки экрана его не показывают.
    let showsDevelopmentSignIn: Bool
    @State private var model: SignInModel

    init(app: AppModel, reason: AppModel.SignOutReason?, showsDevelopmentSignIn: Bool = AppConfig.devSignInAvailable) {
        self.init(model: SignInModel(app: app), reason: reason, showsDevelopmentSignIn: showsDevelopmentSignIn)
    }

    /// С готовой моделью — для снимков экрана с сообщением под кнопками.
    init(model: SignInModel, reason: AppModel.SignOutReason?, showsDevelopmentSignIn: Bool) {
        self.reason = reason
        self.showsDevelopmentSignIn = showsDevelopmentSignIn
        _model = State(initialValue: model)
    }

    var body: some View {
        SignInContent(model: model, reason: reason, showsDevelopmentSignIn: showsDevelopmentSignIn)
            .background(Color(.bg).ignoresSafeArea())
    }
}

private struct SignInContent: View {
    let model: SignInModel
    let reason: AppModel.SignOutReason?
    let showsDevelopmentSignIn: Bool
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: GPSpace.s48)
                    header
                    Spacer(minLength: GPSpace.s40)
                    if reason == .sessionExpired {
                        Text("Вход закончился — войдите снова.")
                            .gpText(\.meta)
                            .foregroundStyle(Color(.text2))
                            .padding(.bottom, GPSpace.s16)
                            .accessibilityIdentifier("signin.expired")
                    }
                    buttons
                    if let message = model.message {
                        SignInMessageText(message: message)
                            .padding(.top, GPSpace.s12)
                    }
                    legal
                        .padding(.top, GPSpace.s20)
                    #if DEBUG
                        if showsDevelopmentSignIn {
                            DevelopmentSignInForm(model: model)
                                .padding(.top, GPSpace.s24)
                        }
                    #endif
                }
                .frame(maxWidth: GPLayout.authColumnMax)
                .padding(.horizontal, GPSpace.s24)
                .padding(.bottom, GPSpace.s28)
                .frame(maxWidth: .infinity, minHeight: proxy.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: GPSpace.s20) {
            BrandMark()
                .frame(width: GPSpace.s32, height: GPSpace.s32)
                .foregroundStyle(Color(.verbal))
                .frame(width: GPSize.sectionRow, height: GPSize.sectionRow)
                .background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: GPSpace.s10) {
                Text(
                    verbatim: Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? "GrePrepApp"
                )
                .gpText(\.h1)
                .foregroundStyle(Color(.text))
                .accessibilityAddTraits(.isHeader)
                Text("Подготовка к GRE® с разбором каждой ошибки — по-русски и по-английски.")
                    .gpText(\.lead)
                    .foregroundStyle(Color(.text2))
                    .frame(maxWidth: GPLayout.textMax, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var buttons: some View {
        VStack(spacing: GPSpace.s10) {
            AppleSignInButton(model: model)
            GoogleSignInButton(isBusy: model.busy == .google) {
                Task { await model.signInWithWeb(.google, authenticate: authenticate) }
            }
        }
        .disabled(model.busy != nil)
    }

    private var legal: some View {
        VStack(spacing: GPSpace.s10) {
            Text("Продолжая, вы принимаете условия и политику конфиденциальности.")
            Text(verbatim: GREBrand.disclaimer)
                .environment(\.locale, Locale(identifier: "en"))
        }
        .gpText(\.caption)
        .foregroundStyle(Color(.text3))
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Системное окно входа (адрес возврата — WebSignIn.callback).
    private func authenticate(_ url: URL, _ redirect: URL) async throws -> URL {
        try await webAuthenticationSession.authenticate(
            using: url, callback: WebSignIn.callback(for: redirect), preferredBrowserSession: .ephemeral,
            additionalHeaderFields: [:])
    }
}

private struct SignInMessageText: View {
    let message: SignInModel.Message

    var body: some View {
        text
            .gpText(\.meta)
            // «Ещё не подключён» — сведение, а не сбой: без цвета ошибки.
            .foregroundStyle(isFailure ? Color(.wrong) : Color(.text2))
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("signin.message")
    }

    private var isFailure: Bool {
        if case .notConnectedYet = message { return false }
        return true
    }

    private var text: Text {
        switch message {
        case .notConnectedYet(.google): Text("Вход через Google ещё не подключён — он появится до беты.")
        case .notConnectedYet(.apple): Text("Вход с Apple ещё не подключён — он появится до беты.")
        case .notConnectedYet: Text("Этот способ входа ещё не подключён.")
        case .offline: Text("Нет сети — войти получится, когда она появится.")
        case .tooManyAttempts: Text("Слишком много попыток подряд — подождите минуту.")
        case .failed: Text("Не получилось войти. Попробуйте ещё раз.")
        }
    }
}

#if DEBUG
    /// Вход подменой (`/api/auth/dev`): локально и в сценариях UI. В релизной сборке этого кода нет (#if DEBUG).
    private struct DevelopmentSignInForm: View {
        let model: SignInModel
        @State private var name = ""

        var body: some View {
            VStack(alignment: .leading, spacing: GPSpace.s8) {
                Text("Для разработки — вход подменой")
                    .gpText(\.meta)
                    .foregroundStyle(Color(.text2))
                HStack(spacing: GPSpace.s8) {
                    TextField(text: $name) { Text("Имя тестового пользователя") }
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                        #if os(iOS)
                            .textInputAutocapitalization(.never)
                        #endif
                        .onSubmit(submit)
                        .accessibilityIdentifier("signin.dev.name")
                    Button(action: submit) {
                        if model.busy == .development {
                            ProgressView()
                        } else {
                            Text("Войти")
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || model.busy != nil)
                    .accessibilityIdentifier("signin.dev.submit")
                }
            }
            .padding(GPSpace.s12)
            .background(Color(.surface2), in: RoundedRectangle(cornerRadius: GPRadius.m, style: .continuous))
        }

        private func submit() {
            Task { await model.signInForDevelopment(name: name) }
        }
    }
#endif
