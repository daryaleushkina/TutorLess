// Сгенерировано scripts/svg2swift.py из scripts/logos/*.svg — руками не править.
import SwiftUI

/// Часть «G» Google, цвет red.
struct GoogleGRed: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 48, rect.height / 48)
        let path = Path { p in
            p.move(to: CGPoint(x: 24, y: 9.5))
            p.addCurve(
                to: CGPoint(x: 33.21, y: 13.1), control1: CGPoint(x: 27.54, y: 9.5),
                control2: CGPoint(x: 30.71, y: 10.72))
            p.addLine(to: CGPoint(x: 40.06, y: 6.25))
            p.addCurve(to: CGPoint(x: 24, y: 0), control1: CGPoint(x: 35.9, y: 2.38), control2: CGPoint(x: 30.47, y: 0))
            p.addCurve(
                to: CGPoint(x: 2.56, y: 13.22), control1: CGPoint(x: 14.62, y: 0), control2: CGPoint(x: 6.51, y: 5.38))
            p.addLine(to: CGPoint(x: 10.54, y: 19.41))
            p.addCurve(
                to: CGPoint(x: 24, y: 9.5), control1: CGPoint(x: 12.43, y: 13.72), control2: CGPoint(x: 17.74, y: 9.5))
            p.closeSubpath()
        }
        return path.applying(
            CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: rect.minX / scale, y: rect.minY / scale))
    }
}

/// Часть «G» Google, цвет blue.
struct GoogleGBlue: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 48, rect.height / 48)
        let path = Path { p in
            p.move(to: CGPoint(x: 46.98, y: 24.55))
            p.addCurve(
                to: CGPoint(x: 46.6, y: 20), control1: CGPoint(x: 46.98, y: 22.98),
                control2: CGPoint(x: 46.83, y: 21.46))
            p.addLine(to: CGPoint(x: 24, y: 20))
            p.addLine(to: CGPoint(x: 24, y: 29.02))
            p.addLine(to: CGPoint(x: 36.94, y: 29.02))
            p.addCurve(
                to: CGPoint(x: 32.16, y: 36.2), control1: CGPoint(x: 36.36, y: 31.98),
                control2: CGPoint(x: 34.68, y: 34.5))
            p.addLine(to: CGPoint(x: 39.89, y: 42.2))
            p.addCurve(
                to: CGPoint(x: 46.98, y: 24.55), control1: CGPoint(x: 44.4, y: 38.02),
                control2: CGPoint(x: 46.98, y: 31.84))
            p.closeSubpath()
        }
        return path.applying(
            CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: rect.minX / scale, y: rect.minY / scale))
    }
}

/// Часть «G» Google, цвет yellow.
struct GoogleGYellow: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 48, rect.height / 48)
        let path = Path { p in
            p.move(to: CGPoint(x: 10.53, y: 28.59))
            p.addCurve(
                to: CGPoint(x: 9.77, y: 24), control1: CGPoint(x: 10.05, y: 27.14), control2: CGPoint(x: 9.77, y: 25.6))
            p.addCurve(
                to: CGPoint(x: 10.53, y: 19.41), control1: CGPoint(x: 9.77, y: 22.4),
                control2: CGPoint(x: 10.04, y: 20.86))
            p.addLine(to: CGPoint(x: 2.55, y: 13.22))
            p.addCurve(
                to: CGPoint(x: 0, y: 24), control1: CGPoint(x: 0.92, y: 16.46), control2: CGPoint(x: 0, y: 20.12))
            p.addCurve(
                to: CGPoint(x: 2.56, y: 34.78), control1: CGPoint(x: 0, y: 27.88), control2: CGPoint(x: 0.92, y: 31.54))
            p.addLine(to: CGPoint(x: 10.53, y: 28.59))
            p.closeSubpath()
        }
        return path.applying(
            CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: rect.minX / scale, y: rect.minY / scale))
    }
}

/// Часть «G» Google, цвет green.
struct GoogleGGreen: Shape {
    func path(in rect: CGRect) -> Path {
        let scale = min(rect.width / 48, rect.height / 48)
        let path = Path { p in
            p.move(to: CGPoint(x: 24, y: 48))
            p.addCurve(
                to: CGPoint(x: 39.89, y: 42.19), control1: CGPoint(x: 30.48, y: 48),
                control2: CGPoint(x: 35.93, y: 45.87))
            p.addLine(to: CGPoint(x: 32.16, y: 36.19))
            p.addCurve(
                to: CGPoint(x: 24, y: 38.49), control1: CGPoint(x: 30.01, y: 37.64),
                control2: CGPoint(x: 27.24, y: 38.49))
            p.addCurve(
                to: CGPoint(x: 10.53, y: 28.58), control1: CGPoint(x: 17.74, y: 38.49),
                control2: CGPoint(x: 12.43, y: 34.27))
            p.addLine(to: CGPoint(x: 2.55, y: 34.77))
            p.addCurve(
                to: CGPoint(x: 24, y: 48), control1: CGPoint(x: 6.51, y: 42.62), control2: CGPoint(x: 14.62, y: 48))
            p.closeSubpath()
        }
        return path.applying(
            CGAffineTransform(scaleX: scale, y: scale).translatedBy(x: rect.minX / scale, y: rect.minY / scale))
    }
}

/// Цветная «G» Google — цвета самой Google, не наши токены (правила Google Identity).
struct GoogleGLogo: View {
    var body: some View {
        ZStack {
            GoogleGRed().fill(Color(red: 0xEA / 255, green: 0x43 / 255, blue: 0x35 / 255))
            GoogleGBlue().fill(Color(red: 0x42 / 255, green: 0x85 / 255, blue: 0xF4 / 255))
            GoogleGYellow().fill(Color(red: 0xFB / 255, green: 0xBC / 255, blue: 0x05 / 255))
            GoogleGGreen().fill(Color(red: 0x34 / 255, green: 0xA8 / 255, blue: 0x53 / 255))
        }
    }
}
