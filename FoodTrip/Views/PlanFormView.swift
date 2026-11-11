import SwiftUI

/// The first screen: where, when, how many meals, how much. Saved trips sit underneath.
struct PlanFormView: View {
    @Environment(AppModel.self) private var model
    @State private var request = TripRequest.nextWeekend(cityID: "chicago-il")
    @State private var path: [TripRequest] = []
    @State private var showPaywall = false
    @Environment(Store.self) private var store

    private var city: City? { model.city(request.cityID) }
    private var startDate: Binding<Date> {
        Binding(get: { Day.local(request.start) }, set: { d in
            request.start = Day.iso(local: d)
            if request.end < request.start { request.end = request.start }
            if Day.add(request.start, 13) < request.end { request.end = Day.add(request.start, 13) }
        })
    }
    private var endDate: Binding<Date> {
        Binding(get: { Day.local(request.end) }, set: { request.end = Day.iso(local: $0) })
    }
    private static let mealNotes = [1: "Dinner", 2: "Lunch and dinner", 3: "Breakfast, lunch and dinner", 4: "Breakfast, lunch, an afternoon treat and dinner"]

    var body: some View {
        NavigationStack(path: $path) {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Plan where to eat on your trip.")
                            .font(.largeTitle.bold())
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Pick a city, dates, meals and a budget. FoodTrip plans every meal.")
                            .foregroundStyle(.secondary)
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 4, bottom: 4, trailing: 4))
                }

                Section("Where and when") {
                    NavigationLink {
                        CityPickerView(selection: $request.cityID)
                    } label: {
                        LabeledContent("City", value: city?.title ?? "Choose")
                    }
                    .accessibilityIdentifier("cityRow")
                    DatePicker("Arrive", selection: startDate, in: Calendar.current.startOfDay(for: Date())..., displayedComponents: .date)
                    DatePicker("Leave", selection: endDate, in: Day.local(request.start)...Day.local(Day.add(request.start, 13)), displayedComponents: .date)
                }

                Section {
                    Picker("Meals a day", selection: $request.meals) {
                        ForEach(1...4, id: \.self) { Text("\($0)").tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("mealsPicker")
                } header: {
                    Text("Meals a day")
                } footer: {
                    Text(Self.mealNotes[request.meals] ?? "")
                }

                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("$\(request.budget)").font(.title2.bold()).monospacedDigit()
                            Text("a day, per person").foregroundStyle(.secondary)
                        }
                        Slider(value: Binding(get: { Double(request.budget) }, set: { request.budget = Int($0) }), in: 30...400, step: 10) {
                            Text("Food budget a day, per person")
                        }
                        .accessibilityValue("$\(request.budget)")
                    }
                    Stepper(value: $request.party, in: 1...20) {
                        LabeledContent("People", value: "\(request.party)")
                    }
                } header: {
                    Text("Budget")
                } footer: {
                    Text("Food, tax and tip. Drinks not included.")
                }

                if !model.saved.isEmpty {
                    Section("Your trips") {
                        ForEach(model.saved) { trip in
                            NavigationLink(value: trip) { SavedTripRow(trip: trip) }
                        }
                        .onDelete { offsets in offsets.map { model.saved[$0] }.forEach(model.delete) }
                    }
                }
            }
            .navigationTitle("FoodTrip")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                Button {
                    guard store.unlocked || model.freeTripsLeft > 0 else { showPaywall = true; return }
                    var r = request
                    r.id = UUID()
                    r.locked = [:]
                    model.planNew(r)
                    path.append(r)
                } label: {
                    Text("Plan my food trip").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .disabled(city == nil)
                .accessibilityIdentifier("planButton")
                .padding(.horizontal, 20)
                .padding(.top, 10)
                .padding(.bottom, store.unlocked ? 10 : 30)
                .overlay(alignment: .bottom) {
                    if !store.unlocked {
                        Text(model.freeTripsLeft > 0 ? "\(model.freeTripsLeft) of \(AppModel.freeTrips) free trips left" : "Free trips used · unlock for \(store.price)")
                            .font(.footnote).foregroundStyle(.secondary).padding(.bottom, 8)
                            .accessibilityIdentifier("freeTripsNote")
                    }
                }
                .background(.bar)
            }
            .sheet(isPresented: $showPaywall) { PaywallView() }
            #if DEBUG
            .onAppear {
                // `-screen itinerary|swap|paywall` opens one screen with a fixed Chicago trip (Debug builds only; see CLAUDE.md)
                guard let screen = UserDefaults.standard.string(forKey: "screen"), path.isEmpty, !showPaywall else { return }
                if screen == "paywall" { showPaywall = true }
                if screen == "itinerary" || screen == "swap" {
                    path = [TripRequest(cityID: "chicago-il", start: "2026-12-04", end: "2026-12-06", meals: 3, budget: 150, party: 2, seed: 7)]
                }
            }
            #endif
            .navigationDestination(for: TripRequest.self) { ItineraryView(request: $0) }
        }
    }
}

private struct SavedTripRow: View {
    @Environment(AppModel.self) private var model
    let trip: TripRequest

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(model.city(trip.cityID)?.title ?? trip.cityID).font(.headline)
            Text("\(Format.short(trip.start)) – \(Format.short(trip.end)) · \(trip.meals) meal\(trip.meals == 1 ? "" : "s") a day · $\(trip.budget) a day")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

struct CityPickerView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: String
    @State private var query = ""

    private var results: [City] {
        let q = query.trimmingCharacters(in: .whitespaces)
        return q.isEmpty ? model.cities : model.cities.filter { $0.title.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        List(results) { city in
            Button {
                selection = city.id
                dismiss()
            } label: {
                HStack {
                    VStack(alignment: .leading) {
                        Text(city.title).foregroundStyle(.primary)
                        Text("\(city.count) places").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if city.id == selection { Image(systemName: "checkmark").foregroundStyle(.tint) }
                }
            }
        }
        .overlay { if results.isEmpty { ContentUnavailableView.search(text: query) } }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search \(model.cities.count) cities")
        .navigationTitle("City")
        .navigationBarTitleDisplayMode(.inline)
    }
}

enum Format {
    private static func formatter(_ template: String) -> DateFormatter {
        let f = DateFormatter(); f.setLocalizedDateFormatFromTemplate(template); return f
    }
    private static let shortF = formatter("MMMd")
    private static let longF = formatter("EEEEMMMMd")
    private static let timeF: DateFormatter = { let f = DateFormatter(); f.timeStyle = .short; f.dateStyle = .none; return f }()

    static func short(_ iso: String) -> String { shortF.string(from: Day.local(iso)) }
    static func long(_ iso: String) -> String { longF.string(from: Day.local(iso)) }
    /// "7:00 PM" for a slot's "19:00"
    static func time(_ hm: String) -> String {
        let t = hm.split(separator: ":").compactMap { Int($0) }
        guard t.count == 2, let d = Calendar.current.date(from: DateComponents(year: 2026, month: 1, day: 1, hour: t[0], minute: t[1])) else { return hm }
        return timeF.string(from: d)
    }
}
