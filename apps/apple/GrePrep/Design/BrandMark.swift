import SwiftUI

/// Знак Tutorless в оболочке B: две цветные плоскости, без ленты удалённого раздела.
struct BrandMark: View {
    var body: some View {
        Image(systemName: "square.stack.fill")
            .symbolRenderingMode(.palette)
            .foregroundStyle(Color(.accent), Color(.examGre))
            .accessibilityHidden(true)
    }
}
