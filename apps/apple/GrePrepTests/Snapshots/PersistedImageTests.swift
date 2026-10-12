#if os(iOS)
    import SnapshotTesting
    import Testing
    import UIKit

    @MainActor
    @Suite("Сравнение сохранённого кадра")
    struct PersistedImageTests {
        @Test("единичный шум float16-кадра сравнивается с PNG при прежних порогах")
        func extendedRangeNoise() throws {
            let strategy = Snapshotting<UIImage, UIImage>.image(
                precision: 0.995, perceptualPrecision: 0.98, scale: 2
            ).comparingPersistedImage()
            let original = try image()
            let reference = strategy.diffing.fromData(strategy.diffing.toData(original))
            let noisy = try image(noise: true)
            #expect(try #require(noisy.cgImage).bitmapInfo.contains(.floatComponents))
            #expect(!((try #require(reference.cgImage)).bitmapInfo.contains(.floatComponents)))
            #expect(strategy.diffing.diffV2(reference, noisy) == nil)
        }

        @Test("PNG-нормализация сохраняет отказ при настоящем изменении цвета")
        func visibleColorChange() throws {
            let strategy = Snapshotting<UIImage, UIImage>.image(
                precision: 0.995, perceptualPrecision: 0.98, scale: 2
            ).comparingPersistedImage()
            let original = try image()
            let reference = strategy.diffing.fromData(strategy.diffing.toData(original))
            #expect(reference.scale == original.scale)
            #expect(strategy.diffing.diffV2(reference, try image(accentBlue: 0.2)) != nil)
        }

        private func image(noise: Bool = false, accentBlue: CGFloat = 0.95) throws -> UIImage {
            let space = try #require(CGColorSpace(name: CGColorSpace.extendedSRGB))
            let context = try #require(
                CGContext(
                    data: nil, width: 64, height: 64, bitsPerComponent: 16, bytesPerRow: 0,
                    space: space,
                    bitmapInfo: CGBitmapInfo.floatComponents.rawValue | CGBitmapInfo.byteOrder16Little.rawValue
                        | CGImageAlphaInfo.premultipliedLast.rawValue))
            context.setFillColor(red: 10 / 255, green: 15 / 255, blue: 31 / 255, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
            context.setFillColor(red: 0.4, green: 0.5, blue: accentBlue, alpha: 1)
            context.fill(CGRect(x: 8, y: 8, width: 48, height: 48))
            if noise {
                context.setFillColor(red: 31 / 255, green: 15 / 255, blue: 31 / 255, alpha: 1)
                context.fill(CGRect(x: 0, y: 0, width: 1, height: 1))
            }
            return UIImage(cgImage: try #require(context.makeImage()), scale: 2, orientation: .up)
        }
    }
#endif
