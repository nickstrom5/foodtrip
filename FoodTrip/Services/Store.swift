import Foundation
import Observation
import StoreKit

/// The one purchase: unlimited trips, bought once. The first five trips are free (`AppModel.freeTrips`).
@MainActor
@Observable
final class Store {
    static let unlimitedID = "app.getfoodtrip.foodtrip.unlimited"
    /// shown until the App Store answers with the real, localized price
    static let fallbackPrice = "$1.99"

    private(set) var product: Product?
    private(set) var unlocked = false
    private(set) var busy = false
    var error: String?
    private var updates: Task<Void, Never>?

    var price: String { product?.displayPrice ?? Self.fallbackPrice }

    init() {
        updates = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let t) = update { await t.finish() }
                await self?.refresh()
            }
        }
        Task { await load() }
    }

    func load() async {
        await refresh()
        if product == nil { product = try? await Product.products(for: [Self.unlimitedID]).first }
    }

    /// Unlocked when the App Store holds a verified, unrevoked purchase for this Apple Account.
    func refresh() async {
        var owned = false
        for await entitlement in Transaction.currentEntitlements {
            if case .verified(let t) = entitlement, t.productID == Self.unlimitedID, t.revocationDate == nil { owned = true }
        }
        unlocked = owned
    }

    func buy() async {
        busy = true
        defer { busy = false }
        if product == nil { await load() }
        guard let product else { error = "The App Store isn't answering. Check your connection and try again."; return }
        do {
            switch try await product.purchase() {
            case .success(.verified(let t)):
                await t.finish()
                await refresh()
            case .success(.unverified):
                error = "The App Store couldn't verify that purchase."
            case .pending:
                error = "Your purchase is waiting for approval. FoodTrip unlocks as soon as it goes through."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func restore() async {
        busy = true
        defer { busy = false }
        do { try await AppStore.sync() } catch { self.error = error.localizedDescription }
        await refresh()
        if !unlocked && error == nil { error = "No FoodTrip purchase was found for this Apple Account." }
    }
}
