import SwiftUI

/// Shown when the five free trips are used. One price, paid once.
struct PaywallView: View {
    @Environment(Store.self) private var store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Image(systemName: "fork.knife.circle.fill")
                        .font(.system(size: 64))
                        .foregroundStyle(.tint)
                        .padding(.top, 24)
                        .accessibilityHidden(true)
                    Text("You've planned your \(AppModel.freeTrips) free trips")
                        .font(.title.bold())
                        .multilineTextAlignment(.center)
                    Text("Unlock FoodTrip to keep planning. Pay once, plan every trip after this one.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Unlimited trips in every city", systemImage: "infinity")
                        Label("Reservations, calendar and sharing", systemImage: "calendar.badge.plus")
                        Label("One payment. No subscription.", systemImage: "checkmark.seal")
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    Text("Your saved trips stay open, with swaps and shuffles, whether you unlock or not.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)
            }
            .background(Color(.systemGroupedBackground))
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 10) {
                    Button {
                        Task { await store.buy() }
                    } label: {
                        Group {
                            if store.busy { ProgressView() } else { Text("Unlock for \(store.price)") }
                        }
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .disabled(store.busy)
                    .accessibilityIdentifier("unlockButton")
                    Button("Restore purchase") { Task { await store.restore() } }
                        .font(.subheadline)
                        .disabled(store.busy)
                }
                .padding(.horizontal, 20).padding(.vertical, 10)
                .background(.bar)
            }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Not now") { dismiss() } } }
            .alert("FoodTrip", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(store.error ?? "")
            }
            .onChange(of: store.unlocked) { _, unlocked in if unlocked { dismiss() } }
        }
    }
}
