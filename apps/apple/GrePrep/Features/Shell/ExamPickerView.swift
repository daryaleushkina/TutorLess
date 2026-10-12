import GPAPI
import SwiftUI

extension Exam {
    var title: String { rawValue.uppercased() }
    var color: Color { self == .gre ? Color(.examGre) : Color(.examToefl) }
    var purpose: LocalizedStringKey { self == .gre ? "Магистратура и PhD" : "Английский для учёбы" }
    var parts: String {
        self == .gre ? "Verbal · Quant · Analyze an Issue" : "Reading · Listening · Writing · Speaking"
    }
}

struct ExamSwitcher: View {
    let model: ShellModel
    @Environment(\.gpType) private var type
    @Environment(\.textScale) private var textScale
    @Environment(\.gpWideLayout) private var wide
    @State private var presented = false
    init(model: ShellModel, presented: Bool = false) {
        self.model = model
        _presented = State(initialValue: presented)
    }
    #if os(iOS)
        @Environment(\.horizontalSizeClass) private var sizeClass
    #endif
    private var usesPopover: Bool {
        #if os(iOS)
            wide || sizeClass == .regular
        #else
            true
        #endif
    }
    var body: some View {
        Group {
            if usesPopover {
                button.popover(isPresented: $presented, arrowEdge: .top) {
                    picker.frame(width: GPLayout.authColumnMax).fixedSize(horizontal: false, vertical: true)
                }
            } else {
                button.sheet(isPresented: $presented) {
                    ScrollView { picker }.background(Color(.bg))
                        .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
                }
            }
        }
    }
    private var button: some View {
        Button {
            presented = true
        } label: {
            HStack(spacing: GPSpace.s8) {
                RoundedRectangle(cornerRadius: GPSpace.s4).fill(model.exam?.color ?? Color(.text3))
                    .frame(width: GPSpace.s12, height: GPSpace.s12)
                Text(verbatim: model.exam?.title ?? "")
                    .font(.gp(type.h3, scale: textScale))
                    .tracking(type.h3.tracking * type.h3.size * textScale)
                    .foregroundStyle(Color(.text)).fixedSize()
                Image(systemName: presented ? "chevron.up" : "chevron.down").foregroundStyle(Color(.text3))
                    .gpText(\.caption)
            }.padding(.horizontal, GPSpace.s12).frame(minHeight: GPSize.tapTarget)
                .background(Color(.surface), in: Capsule())
        }.buttonStyle(.plain).labelStyle(.titleAndIcon).accessibilityIdentifier("shell.exam")
            .accessibilityLabel(Text("Сменить экзамен"))
            .accessibilityValue(model.exam?.title ?? "")
    }
    private var picker: some View {
        ExamPickerView(model: model, firstEntry: false) { presented = false }
            .gpDesignTokens().environment(\.locale, Locale(identifier: model.locale.rawValue))
    }
}

struct ExamPickerView: View {
    let model: ShellModel
    let firstEntry: Bool
    var onChosen: () -> Void = {}
    @Environment(\.gpWideLayout) private var wide

    var body: some View {
        Group {
            if firstEntry {
                GeometryReader { proxy in
                    let wide = proxy.size.width >= GPLayout.contentMax + 2 * GPLayout.gutter
                    ScrollView {
                        contents(wide: wide)
                            .frame(
                                maxWidth: GPLayout.contentMax,
                                minHeight: wide ? nil : proxy.size.height - 2 * GPLayout.gutter, alignment: .leading
                            )
                            .padding(GPLayout.gutter)
                            .frame(maxWidth: .infinity, minHeight: wide ? proxy.size.height : nil)
                    }
                }
            } else {
                contents(wide: false).padding(GPLayout.gutter)
            }
        }
        .background(Color(.bg).ignoresSafeArea())
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(firstEntry ? "exam.firstEntry" : "exam.switcher")
    }

    private func contents(wide: Bool) -> some View {
        VStack(alignment: .leading, spacing: GPSpace.s24) {
            if firstEntry {
                TutorlessWordmark()
                if !wide { Spacer(minLength: GPSpace.s48) }
                Text("К какому экзамену готовитесь?").gpText(\.h1).accessibilityAddTraits(.isHeader)
                Text("От него зависят задания, слова и пробный экзамен. Сменить можно в любой момент.")
                    .gpText(\.lead).foregroundStyle(Color(.text2)).fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Экзамен").gpText(\.h2).accessibilityAddTraits(.isHeader)
            }
            if model.exams.isEmpty {
                ShellUnavailableView(problem: model.problem, retry: { Task { await model.refresh() } })
            } else if wide {
                HStack(alignment: .top, spacing: GPSpace.s12) {
                    ForEach(model.exams, id: \.id) { exam in option(exam) }
                }
            } else {
                VStack(spacing: GPSpace.s12) {
                    ForEach(model.exams, id: \.id) { exam in option(exam) }
                }
            }
            if let problem = model.examProblem {
                ShellNotice(
                    symbol: problem == .offline ? "wifi.slash" : "exclamationmark.circle",
                    message:
                        problem == .offline
                        ? "Нет сети — выбрать экзамен получится, когда она вернётся."
                        : firstEntry
                            ? "Не получилось сохранить выбор. Попробуйте ещё раз."
                            : "Не получилось сменить экзамен. Попробуйте ещё раз."
                )
                .accessibilityIdentifier("exam.error")
            }
            if !firstEntry {
                Text("У каждого экзамена свой прогресс, при смене он не теряется.")
                    .gpText(\.meta).foregroundStyle(Color(.text3)).fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func option(_ exam: ExamInfo) -> some View {
        Button {
            Task { if await model.choose(exam.id) { onChosen() } }
        } label: {
            ExamOptionRow(
                exam: exam.id, selected: !firstEntry && model.exam == exam.id, busy: model.choosing == exam.id)
        }
        .buttonStyle(.plain)
        .allowsHitTesting(model.choosing == nil && !model.changingLocale)
        .opacity(model.choosing != nil && model.choosing != exam.id ? GPOpacity.disabled : 1)
        .accessibilityIdentifier("exam.choose.\(exam.id.rawValue)")
        .accessibilityAddTraits(model.exam == exam.id ? .isSelected : [])
    }
}

struct ExamOptionRow: View {
    let exam: Exam
    let selected: Bool
    let busy: Bool
    var body: some View {
        HStack(spacing: GPSpace.s14) {
            Text(verbatim: exam.title).gpText(\.h3).foregroundStyle(Color(.onAccent))
                .frame(width: GPSpace.s72, height: GPSize.button)
                .background(exam.color, in: RoundedRectangle(cornerRadius: GPRadius.m))
            VStack(alignment: .leading, spacing: GPSpace.s4) {
                Text(exam.purpose).gpText(\.h3)
                Text(verbatim: exam.parts).gpText(\.caption).foregroundStyle(Color(.text3))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: GPSpace.s4)
            if busy {
                ProgressView()
            } else {
                Image(systemName: selected ? "checkmark.circle.fill" : "chevron.forward")
                    .foregroundStyle(Color(.text3))
            }
        }
        .padding(GPSpace.s16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l))
    }
}

struct TutorlessWordmark: View {
    var body: some View {
        HStack(spacing: GPSpace.s8) {
            BrandMark().frame(width: GPSize.icon, height: GPSize.icon).foregroundStyle(Color(.accent))
                .accessibilityHidden(true)
            Text(verbatim: "Tutorless").gpText(\.h2)
        }
    }
}
