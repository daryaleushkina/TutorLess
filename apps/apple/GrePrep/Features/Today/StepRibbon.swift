import SwiftUI

/// Лента шагов дня (DESIGN.md, «Лента»): узлы на нити, в фокусе один шаг — карточка на поверхности, остальное —
/// тихие строки; конец ленты виден.
struct StepRibbon: View {
    let plan: TodayPlan
    /// Шаг, который нельзя начать без сети: под ним — объяснение (решение Даши 06.10.2026).
    let blockedStepID: TodayPlan.Step.ID?
    let onSelect: (TodayPlan.Step) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(plan.steps) { step in
                StepRow(step: step, isBlocked: step.id == blockedStepID, onSelect: onSelect)
            }
            RibbonEnd(isComplete: plan.isComplete)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("План на сегодня"))
    }
}

/// Колонка узлов: шире узла на кольцо текущего шага. Нить идёт по её центру.
private let nodeColumn: CGFloat = GPSize.iconButton
private let rowGap: CGFloat = GPSpace.s24
/// Внутренний отступ карточки шага (DESIGN.md, компонент card).
private let cardPadding: CGFloat = GPSpace.s16

private struct StepRow: View {
    @Environment(\.gpType) private var type
    let step: TodayPlan.Step
    let isBlocked: Bool
    let onSelect: (TodayPlan.Step) -> Void

    var body: some View {
        HStack(alignment: .top, spacing: GPSpace.s14) {
            node
                .frame(width: nodeColumn)
                .frame(maxHeight: .infinity, alignment: .top)
                .background(alignment: .top) { thread }
            content
                .padding(.bottom, rowGap)
        }
        .fixedSize(horizontal: false, vertical: true)
    }

    /// Узел стоит по центру первой строки своего шага: у текущего — строки заголовка карточки.
    private var nodeTop: CGFloat {
        step.state == .current
            ? cardPadding + type.h2.lineHeight / 2 - GPSize.iconButton / 2
            : max(0, type.body.lineHeight / 2 - GPSize.icon / 2)
    }
    private var nodeSize: CGFloat { step.state == .current ? GPSize.iconButton : GPSize.icon }

    /// Нить от узла вниз, до следующего шага.
    private var thread: some View {
        Rectangle()
            .fill(Color(.line))
            .frame(width: GPSize.hairline)
            .padding(.top, nodeTop + nodeSize + GPSpace.s4)
            .accessibilityHidden(true)
    }

    @ViewBuilder private var node: some View {
        switch step.state {
        case .current:
            Image(systemName: step.section.symbol)
                .font(.system(size: GPSize.iconButton / 2, weight: .semibold))
                .foregroundStyle(Color(.surface))
                .frame(width: GPSize.iconButton, height: GPSize.iconButton)
                .background(step.section.color, in: Circle())
                .background(step.section.tint, in: Circle().inset(by: -GPSpace.s4))
                .padding(.top, nodeTop)
                .accessibilityHidden(true)
        case .next:
            Image(systemName: step.section.symbol)
                .font(.system(size: GPSize.icon / 2, weight: .semibold))
                .foregroundStyle(step.section.color)
                .frame(width: GPSize.icon, height: GPSize.icon)
                .background(Color(.surface), in: Circle())
                .overlay(Circle().strokeBorder(Color(.line), lineWidth: GPSize.hairline))
                .padding(.top, nodeTop)
                .accessibilityHidden(true)
        case .done:
            Image(systemName: "checkmark")
                .font(.system(size: GPSize.icon / 2, weight: .bold))
                .foregroundStyle(Color(.surface))
                .frame(width: GPSize.icon, height: GPSize.icon)
                .background(step.section.color, in: Circle())
                .padding(.top, nodeTop)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder private var content: some View {
        switch step.state {
        case .current:
            CurrentStepCard(step: step, isBlocked: isBlocked, onStart: { onSelect(step) })
        case .next:
            Button {
                onSelect(step)
            } label: {
                QuietStepLabel(step: step, isBlocked: isBlocked)
            }
            .buttonStyle(PressScaleStyle())
            .accessibilityHint(Text("Начать шаг"))
        case .done:
            QuietStepLabel(step: step, isBlocked: false)
        }
    }
}

/// Шаг в фокусе: карточка на поверхности и одна главная кнопка.
private struct CurrentStepCard: View {
    let step: TodayPlan.Step
    let isBlocked: Bool
    let onStart: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: GPSpace.s4) {
            // При самом крупном тексте минуты уходят под название: рядом им не хватает места, и название
            // рвалось бы посреди слова.
            let layout =
                typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: GPSpace.s4))
                : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: GPSpace.s12))
            layout {
                Text(step.title)
                    .gpText(\.h2)
                    .foregroundStyle(Color(.text))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("~\(step.minutes) мин")
                    .gpText(\.meta)
                    .monospacedDigit()
                    .foregroundStyle(Color(.text2))
            }
            Text(step.section.label)
                .gpText(\.meta)
                .fontWeight(.medium)
                .foregroundStyle(step.section.color)
            Button(action: onStart) {
                Text("Начать")
            }
            .buttonStyle(PrimaryCapsuleStyle())
            .padding(.top, GPSpace.s12)
            .accessibilityIdentifier("today.start")
            if isBlocked {
                NeedsNetworkNote()
                    .padding(.top, GPSpace.s8)
            }
        }
        .padding(cardPadding)
        .background(Color(.surface), in: RoundedRectangle(cornerRadius: GPRadius.l, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text("Сейчас: \(step.title)"))
    }
}

/// Шаг не в фокусе: тихая строка на фоне.
private struct QuietStepLabel: View {
    let step: TodayPlan.Step
    let isBlocked: Bool
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: GPSpace.s8) {
            let layout =
                typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: GPSpace.s2))
                : AnyLayout(HStackLayout(alignment: .top, spacing: GPSpace.s12))
            layout {
                VStack(alignment: .leading, spacing: GPSpace.s2) {
                    Text(step.title)
                        .gpText(\.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Color(.text))
                    Text(step.section.label)
                        .gpText(\.meta)
                        .foregroundStyle(step.section.color)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Group {
                    if step.state == .done {
                        Text("\(step.minutes) мин")
                    } else {
                        Text("~\(step.minutes) мин")
                    }
                }
                .gpText(\.meta)
                .monospacedDigit()
                .foregroundStyle(Color(.text2))
            }
            if isBlocked {
                NeedsNetworkNote()
            }
        }
        .frame(minHeight: GPSize.tapTarget, alignment: .top)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Объяснение у шага, который не начать без сети: начатое доживёт без сети, новое — нет (PRODUCT.md).
struct NeedsNetworkNote: View {
    var body: some View {
        Label {
            Text("Чтобы начать, нужна сеть. Когда она появится, всё заработает.")
        } icon: {
            Image(systemName: "wifi.slash")
        }
        .gpText(\.meta)
        .foregroundStyle(Color(.text2))
        .accessibilityIdentifier("today.needsNetwork")
    }
}

/// Видимый конец ленты (COGA: видно, сколько осталось).
private struct RibbonEnd: View {
    let isComplete: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: GPSpace.s14) {
            Circle()
                .fill(Color(.line))
                .frame(width: GPSize.sectionMark, height: GPSize.sectionMark)
                .frame(width: nodeColumn)
                .accessibilityHidden(true)
            if isComplete {
                VStack(alignment: .leading, spacing: GPSpace.s2) {
                    Text("На сегодня всё")
                        .gpText(\.body)
                        .fontWeight(.medium)
                        .foregroundStyle(Color(.text))
                    Text("Завтра здесь будет новый план.")
                        .gpText(\.meta)
                        .foregroundStyle(Color(.text2))
                }
            } else {
                Text("На сегодня всё.")
                    .gpText(\.meta)
                    .foregroundStyle(Color(.text2))
            }
        }
    }
}
