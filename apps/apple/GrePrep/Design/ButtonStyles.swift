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

/// Единственное томатное действие на экране — главная кнопка, без тени (DESIGN.md, «Buttons»).
struct PrimaryCapsuleStyle: ButtonStyle {
    var isBusy = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let active = isEnabled || isBusy
        return configuration.label
            .gpText(\.button)
            .foregroundStyle(active ? Color(.onAccent) : Color(.text3))
            .frame(maxWidth: .infinity, minHeight: GPSize.button)
            .padding(.horizontal, GPSpace.s24)
            .background(active ? Color(.accent) : Color(.surface2), in: Capsule())
            .contentShape(Capsule())
            .allowsHitTesting(!isBusy)
            .accessibilityValue(isBusy ? Text("Загрузка") : Text(""))
            .scaleEffect(configuration.isPressed && !reduceMotion ? GPMotion.pressScale : 1)
            .animation(reduceMotion ? nil : GPMotion.easeOut(duration: GPMotion.press), value: configuration.isPressed)
    }
}

/// Вторичное действие — на спокойной поверхности (DESIGN.md, «Buttons»).
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
