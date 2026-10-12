import GPAPI
import SwiftUI

struct TrainingHomeView: View {
    let model: ShellModel
    @Environment(\.gpWideLayout) private var wide
    var onTraining: (TrainingEntry) -> Void = { _ in }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: GPSpace.s24) {
                if wide { Text("Тренировка").gpText(\.h1).accessibilityAddTraits(.isHeader) }
                if let content = model.home {
                    if let stale = model.staleProblem {
                        ShellNotice(
                            symbol: stale == .offline ? "wifi.slash" : "exclamationmark.circle",
                            message:
                                stale == .offline
                                ? "Нет сети — обновим, когда она появится."
                                : "Не получилось обновить — покажем свежее, как только сервер ответит."
                        )
                        .accessibilityIdentifier("home.stale")
                    }
                    if let training = model.activeTraining {
                        Button {
                            onTraining(.session(training.id))
                        } label: {
                            HStack(spacing: GPSpace.s12) {
                                Image(systemName: "play.circle")
                                VStack(alignment: .leading, spacing: GPSpace.s4) {
                                    Text("Продолжить тренировку").gpText(\.h3)
                                    Text(
                                        "Вопрос \(training.position + 1) из \(training.total) · \(training.session.questionTypes.map(\.label).joined(separator: " · "))"
                                    )
                                    .gpText(\.meta).foregroundStyle(Color(.text3)).fixedSize(
                                        horizontal: false, vertical: true)
                                }
                                Spacer(minLength: GPSpace.s4)
                                Image(systemName: "chevron.forward").foregroundStyle(Color(.text3))
                            }.padding(GPSpace.s16).surface()
                        }.buttonStyle(.plain).accessibilityIdentifier("home.continue")
                    }
                    if let request = model.startRequest {
                        startCard(request)
                    } else {
                        Text("Здесь будут тренировки по четырём частям TOEFL.").gpText(\.lead).foregroundStyle(
                            Color(.text2)
                        )
                        .frame(maxWidth: GPLayout.textMax, alignment: .leading).fixedSize(
                            horizontal: false, vertical: true
                        )
                        .accessibilityIdentifier("home.empty")
                    }
                    Text("Разделы").gpText(\.h2).accessibilityAddTraits(.isHeader)
                    VStack(spacing: 0) {
                        ForEach(Array(model.sections.enumerated()), id: \.element) { index, section in
                            if index > 0 { Divider().overlay(Color(.line)).padding(.horizontal, GPSpace.s16) }
                            sectionRow(section, content: content)
                        }
                    }.surface()
                    if model.hasHistory { statistics(content.stats) }
                    if appReviewClosed {
                        Text("Эта тренировка больше не хранится на устройстве.").gpText(\.meta).foregroundStyle(
                            Color(.text2)
                        ).accessibilityIdentifier("home.reviewClosed")
                    }
                } else if let problem = model.staleProblem {
                    ShellUnavailableView(problem: problem, retry: { Task { await model.refresh() } })
                } else {
                    HomeLoadingView()
                }
            }
            .frame(maxWidth: GPLayout.contentMax, alignment: .leading)
            .padding(GPLayout.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color(.bg).ignoresSafeArea())
        .refreshable { await model.refresh() }
        .accessibilityIdentifier("home.screen")
    }

    @Environment(AppModel.self) private var app
    private var appReviewClosed: Bool { app.trainings.reviewClosed }

    private func startCard(_ request: TrainingRequest) -> some View {
        VStack(alignment: .leading, spacing: GPSpace.s12) {
            Text(verbatim: request.questionTypes.map(\.label).joined(separator: " · ")).gpText(
                wide ? \.startTitleWide : \.startTitle)
            HStack(alignment: .firstTextBaseline, spacing: GPSpace.s8) {
                Circle().fill(StudySection(request.section).color).frame(
                    width: GPSize.sectionMark, height: GPSize.sectionMark)
                Text(verbatim: metadata(request))
                    .gpText(\.meta).foregroundStyle(Color(.text2)).fixedSize(horizontal: false, vertical: true)
            }
            if model.home?.stats.lastTraining != nil {
                Text("Как в прошлый раз").gpText(\.meta).foregroundStyle(Color(.text3))
            } else {
                Text("После каждого ответа — разбор на вашем языке: почему верно и где ловушка в остальных вариантах.")
                    .gpText(\.meta).foregroundStyle(Color(.text2)).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: GPSpace.s10) {
                Button {
                    Task { if let id = await model.start() { onTraining(.session(id)) } }
                } label: {
                    Text(model.starting ? "Начинаем…" : "Начать")
                }.buttonStyle(PrimaryCapsuleStyle(isBusy: model.starting)).accessibilityIdentifier("home.start")
                Button {
                    onTraining(.builder(nil))
                } label: {
                    Image(systemName: "slider.horizontal.3").frame(width: GPSize.button, height: GPSize.button)
                        .background(Color(.surface2), in: Circle())
                }.buttonStyle(.plain).accessibilityLabel(Text("Настроить тренировку"))
                    .accessibilityIdentifier("home.configure").allowsHitTesting(!model.starting)
            }.padding(.top, GPSpace.s12)
            if let problem = model.startProblem {
                ShellNotice(
                    symbol: problem == .offline ? "wifi.slash" : "exclamationmark.circle",
                    message:
                        problem == .offline
                        ? "Чтобы начать, нужна сеть: задания скачаются целиком, и дальше можно без неё."
                        : "Не получилось начать тренировку. Попробуйте ещё раз."
                )
                .accessibilityIdentifier("home.startError")
            }
        }.padding(GPSpace.s20).surface()
    }

    private func metadata(_ request: TrainingRequest) -> String {
        let section = String(interface: StudySection(request.section).label)
        let mode = model.home?.stats.lastTraining == nil ? "" : " · \(String(interface: request.mode.label))"
        return
            "\(section) · \(TrainingCopy.questions(request.count))\(mode) · ~\(model.minutes(request)) \(String(interface: "мин"))"
    }

    @ViewBuilder private func sectionRow(_ section: Components.Schemas.Section, content: HomeContent) -> some View {
        let available = model.types(in: section)
        if available.isEmpty {
            row(section, types: StudySection(section).emptyTypes, stats: nil, active: false)
                .opacity(GPOpacity.disabled).accessibilityIdentifier("home.section.\(section.rawValue)")
        } else {
            Button {
                onTraining(.builder(.init(section: section)))
            } label: {
                row(
                    section, types: available.map { $0.questionType.label }.joined(separator: " · "),
                    stats: content.stats.sections.first { $0.section == section }, active: true)
            }.buttonStyle(.plain).accessibilityIdentifier("home.section.\(section.rawValue)")
        }
    }
    private func row(
        _ section: Components.Schemas.Section, types: String, stats: Components.Schemas.SectionStats?, active: Bool
    ) -> some View {
        HStack(spacing: GPSpace.s12) {
            Circle().fill(StudySection(section).color).frame(width: GPSize.sectionMark, height: GPSize.sectionMark)
            VStack(alignment: .leading, spacing: GPSpace.s4) {
                Text(StudySection(section).label).gpText(\.h3)
                Text(verbatim: types).gpText(\.caption).foregroundStyle(Color(.text3)).lineLimit(1)
            }
            Spacer(minLength: GPSpace.s4)
            if let stats, stats.total > 0 {
                VStack(spacing: GPSpace.s2) {
                    Text("\(Int((Double(stats.correct) / Double(stats.total) * 100).rounded()))%").gpText(\.h3)
                        .monospacedDigit()
                    Text("верно").gpText(\.caption).foregroundStyle(Color(.text3))
                }
            }
            if active { Image(systemName: "chevron.forward").foregroundStyle(Color(.text3)).gpText(\.meta) }
        }.padding(GPSpace.s16).frame(minHeight: GPSize.sectionRow)
    }

    @ViewBuilder private func statistics(_ stats: HomeDTO) -> some View {
        VStack(spacing: 0) {
            if stats.mistakes > 0 {
                Button {
                    Task { if let id = await model.start(mistakes: true) { onTraining(.session(id)) } }
                } label: {
                    HStack(spacing: GPSpace.s12) {
                        Image(systemName: "arrow.triangle.2.circlepath").frame(width: GPSize.icon)
                        VStack(alignment: .leading, spacing: GPSpace.s4) {
                            Text("Повторить мои ошибки").gpText(\.h3)
                            Text("\(stats.mistakes) заданий из прошлых тренировок").gpText(\.caption).foregroundStyle(
                                Color(.text3))
                        }
                        Spacer(minLength: GPSpace.s4)
                        if model.starting {
                            ProgressView()
                        } else {
                            Image(systemName: "chevron.forward").foregroundStyle(Color(.text3))
                        }
                    }.padding(GPSpace.s16)
                }.buttonStyle(.plain).allowsHitTesting(!model.starting).accessibilityIdentifier("home.mistakes")
            }
            if let weak = stats.weakSpot {
                if stats.mistakes > 0 { Divider().overlay(Color(.line)).padding(.horizontal, GPSpace.s16) }
                Button {
                    onTraining(.builder(.init(section: weak.section, type: weak.questionType)))
                } label: {
                    HStack(spacing: GPSpace.s12) {
                        Image(systemName: "scope").frame(width: GPSize.icon)
                        VStack(alignment: .leading, spacing: GPSpace.s4) {
                            Text("Слабое место: \(weak.questionType.label)").gpText(\.h3)
                            Text(
                                "\(String(interface: StudySection(weak.section).label)) · \(Int(weak.accuracy.rounded()))% верно"
                            )
                            .gpText(\.caption).foregroundStyle(Color(.text3))
                        }
                        Spacer(minLength: GPSpace.s4)
                        Image(systemName: "chevron.forward").foregroundStyle(Color(.text3))
                    }.padding(GPSpace.s16)
                }.buttonStyle(.plain).accessibilityIdentifier("home.weakSpot")
            }
        }.surface()
        Text("Эта неделя").gpText(\.h2).accessibilityAddTraits(.isHeader)
        HStack(alignment: .top, spacing: GPSpace.s16) {
            weekValue(stats.week.days, label: "дней")
            weekValue(stats.week.answers, label: "ответов")
            weekValue(stats.week.minutes, label: "минут")
        }.padding(GPSpace.s20).surface().accessibilityIdentifier("home.week")
    }
    private func weekValue(_ value: Int, label: LocalizedStringKey) -> some View {
        VStack(alignment: .leading, spacing: GPSpace.s4) {
            Text(verbatim: value.formatted()).gpText(\.h1).monospacedDigit()
            Text(label).gpText(\.caption).foregroundStyle(Color(.text3))
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct ShellNotice: View {
    let symbol: String
    let message: LocalizedStringKey
    var body: some View {
        HStack(alignment: .top, spacing: GPSpace.s8) {
            Image(systemName: symbol).frame(width: GPSize.iconSm).foregroundStyle(Color(.text3))
            Text(message).gpText(\.meta).foregroundStyle(Color(.text2)).fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

struct ShellUnavailableView: View {
    let problem: ShellModel.Problem?
    let retry: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: GPSpace.s16) {
            if let problem {
                Image(systemName: problem == .offline ? "wifi.slash" : "exclamationmark.circle").foregroundStyle(
                    Color(.text3))
                Text(problem == .offline ? "Нет сети" : "Не получилось загрузить тренировку").gpText(\.h3)
                Text(
                    problem == .offline
                        ? "Тренировка загрузится, когда сеть вернётся."
                        : "Мы уже знаем об ошибке. Попробуйте ещё раз чуть позже."
                )
                .gpText(\.meta).foregroundStyle(Color(.text2)).fixedSize(horizontal: false, vertical: true)
                Button(action: retry) { Text("Попробовать снова") }.buttonStyle(SecondaryCapsuleStyle())
                    .accessibilityIdentifier("home.retry")
            } else {
                HomeLoadingView()
            }
        }.frame(maxWidth: GPLayout.textMax, alignment: .leading).padding(GPLayout.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(Color(.bg).ignoresSafeArea())
    }
}

struct HomeLoadingView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false
    var body: some View {
        VStack(alignment: .leading, spacing: GPSpace.s24) {
            VStack(alignment: .leading, spacing: GPSpace.s16) {
                RoundedRectangle(cornerRadius: GPRadius.s).fill(Color(.surface3)).frame(height: GPSpace.s28)
                RoundedRectangle(cornerRadius: GPRadius.s).fill(Color(.surface3)).frame(height: GPSpace.s16)
                RoundedRectangle(cornerRadius: GPRadius.full).fill(Color(.surface3)).frame(height: GPSize.button)
            }.padding(GPSpace.s20).surface().accessibilityHidden(true)
            Text("Разделы").gpText(\.h2)
            VStack(spacing: GPSpace.s16) {
                ForEach(0..<3) { _ in
                    RoundedRectangle(cornerRadius: GPRadius.s).fill(Color(.surface3)).frame(height: GPSize.sectionRow)
                }
            }.accessibilityHidden(true)
        }
        .opacity(reduceMotion || !pulsing ? 1 : GPOpacity.disabled)
        .animation(
            reduceMotion ? nil : .easeInOut(duration: GPMotion.pulse).repeatForever(autoreverses: true), value: pulsing
        )
        .onAppear { pulsing = true }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("Загружаем тренировку"))
    }
}

extension View {
    fileprivate func surface() -> some View {
        background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l))
            .overlay(RoundedRectangle(cornerRadius: GPRadius.l).stroke(Color(.line), lineWidth: GPSize.hairline))
    }
}
