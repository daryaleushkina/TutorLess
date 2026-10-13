import SwiftUI

/// Нативный эффект символа сохраняет цвет onAccent: ProgressView на Mac игнорирует tint кругового индикатора.
struct BusyIndicator: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Image(systemName: "circle.dotted")
            .font(GPType.systemFont(size: GPSize.icon, weight: .medium))
            .foregroundStyle(Color(.onAccent))
            .symbolEffect(.rotate, options: .repeating, isActive: !reduceMotion)
            .accessibilityHidden(true)
    }
}
