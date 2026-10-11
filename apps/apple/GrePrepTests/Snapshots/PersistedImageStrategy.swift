#if os(iOS)
    import SnapshotTesting
    import UIKit

    extension Snapshotting where Format == UIImage {
        func comparingPersistedImage() -> Self {
            var strategy = self
            let codec = diffing
            // drawHierarchy на iOS 27 даёт float16 Extended sRGB, а pngData сохраняет integer16 Display P3.
            // Perceptual-сравнение библиотеки берёт исходный CGImage: даже почти равные PNG могут дать 0,959
            // совпадений из-за разных форматов. Сравниваем декодированное представление ровно того PNG, который
            // пишется в эталон, через его же кодек (со штатным scale). Рендер, запись и пороги не меняются.
            strategy.diffing.diffV2 = { reference, current in
                codec.diffV2(reference, codec.fromData(codec.toData(current)))
            }
            return strategy
        }
    }
#endif
