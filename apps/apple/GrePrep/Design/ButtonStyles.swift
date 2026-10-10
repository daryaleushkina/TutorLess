import SwiftUI

/// Нажатие без масштаба при «Уменьшить движение».
struct PressScaleStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? GPMotion.pressScale : 1)
            .animation(reduceMotion ? nil : GPMotion.easeOut(duration: GPMotion.press), value: configuration.isPressed)
    }
}

/// Единственный свет на экране — главная кнопка (DESIGN.md, «Правило одного света»).
struct PrimaryCapsuleStyle: ButtonStyle {
    var isBusy = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.gpTheme) private var theme

    func makeBody(configuration: Configuration) -> some View {
        let active = isEnabled || isBusy
        return configuration.label
            .gpText(\.button)
            .foregroundStyle(active ? Color(.onAccent) : Color(.text3))
            .frame(maxWidth: .infinity, minHeight: GPSize.button)
            .padding(.horizontal, GPSpace.s24)
            .background(active ? Color(.accent) : Color(.surface2), in: Capsule())
            .background {
                if active {
                    // spread меняет сам слой до размытия; отрицательный spread сужает свечение.
                    // CSS blur — диаметр размытия, SwiftUI radius — радиус. Сам слой остаётся
                    // под кнопкой, сдвигается только тень; иначе ниже кнопки видна резкая кромка слоя.
                    Capsule().inset(by: -theme.glow.spread)
                        .fill(Color(.accent))
                        .shadow(
                            color: theme.glow.color, radius: theme.glow.blur / 2,
                            x: theme.glow.offsetX, y: theme.glow.offsetY)
                }
            }
            .contentShape(Capsule())
            .allowsHitTesting(!isBusy)
            .accessibilityValue(isBusy ? Text("Загрузка") : Text(""))
            .scaleEffect(configuration.isPressed && !reduceMotion ? GPMotion.pressScale : 1)
            .animation(reduceMotion ? nil : GPMotion.easeOut(duration: GPMotion.press), value: configuration.isPressed)
    }
}

/// Вторичное действие не конкурирует со светом главной кнопки (DESIGN.md, «Secondary (ghost)»).
struct SecondaryCapsuleStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .gpText(\.button)
            .foregroundStyle(isEnabled ? Color(.text) : Color(.text3))
            .frame(minHeight: GPSize.button)
            .padding(.horizontal, GPSpace.s24)
            .background(Color(.surface2), in: Capsule())
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed && !reduceMotion ? GPMotion.pressScale : 1)
            .animation(reduceMotion ? nil : GPMotion.easeOut(duration: GPMotion.press), value: configuration.isPressed)
    }
}
