import Foundation
import Observation

/// What the traveler asked for. Everything a plan is made from, so saving this saves the trip.
struct TripRequest: Codable, Identifiable, Hashable {
    var id = UUID()
    var cityID: String
    /// "yyyy-MM-dd"
    var start: String
    var end: String
    /// 1-4
    var meals = 3
    /// dollars per person per day
    var budget = 120
    var party = 2
    var seed = 1
    /// "<day index>-<slot>" -> place id, for stops the traveler swapped in
    var locked: [String: String] = [:]

    var days: Int { Day.count(from: start, to: end) }

    /// The same link the website writes, so a shared trip opens to the same plan there.
    var shareURL: URL {
        var c = URLComponents()
        c.queryItems = [
            .init(name: "c", value: cityID), .init(name: "s", value: start), .init(name: "e", value: end), .init(name: "m", value: "\(meals)"),
            .init(name: "b", value: "\(budget)"), .init(name: "n", value: "\(party)"), .init(name: "r", value: "\(seed)"),
        ] + (locked.isEmpty ? [] : [.init(name: "lk", value: locked.sorted { $0.key < $1.key }.map { "\($0.key):\($0.value)" }.joined(separator: ","))])
        return URL(string: "https://getfoodtrip.app/#\(c.percentEncodedQuery ?? "")") ?? URL(string: "https://getfoodtrip.app/")!
    }

    static func nextWeekend(cityID: String) -> TripRequest {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let weekday = cal.component(.weekday, from: today)       // 1 Sunday ... 6 Friday
        var ahead = (6 - weekday + 7) % 7
        if ahead == 0 { ahead = 7 }
        let fri = cal.date(byAdding: .day, value: ahead, to: today) ?? today
        let sun = cal.date(byAdding: .day, value: 2, to: fri) ?? fri
        return TripRequest(cityID: cityID, start: Day.iso(local: fri), end: Day.iso(local: sun))
    }
}

@Observable
final class AppModel {
    let cities: [City]
    private(set) var saved: [TripRequest] = []
    private let defaults: UserDefaults
    private static let key = "savedTrips.v1"
    /// trips anyone can plan before the one-time unlock (Store)
    static let freeTrips = 5
    /// how many trips "Plan my food trip" has made. Swaps, shuffles and reopening a saved trip don't count.
    private(set) var tripsPlanned: Int
    var freeTripsLeft: Int { max(0, Self.freeTrips - tripsPlanned) }

    init(file: CityFile = .load(), defaults: UserDefaults = .standard) {
        cities = file.cities.sorted { $0.name < $1.name }
        self.defaults = defaults
        tripsPlanned = defaults.integer(forKey: "tripsPlanned")
        if let data = defaults.data(forKey: Self.key), let trips = try? JSONDecoder().decode([TripRequest].self, from: data) {
            saved = trips.filter { t in file.cities.contains { $0.id == t.cityID } }
        }
    }

    func city(_ id: String) -> City? { cities.first { $0.id == id } }

    func plan(_ r: TripRequest) -> TripPlan? {
        guard let city = city(r.cityID) else { return nil }
        return Planner.plan(city: city, start: r.start, end: r.end, meals: r.meals, budget: r.budget, seed: r.seed, locked: r.locked)
    }

    /// Newest first; saving a trip again (after a swap or a shuffle) replaces it.
    func save(_ r: TripRequest) {
        saved.removeAll { $0.id == r.id }
        saved.insert(r, at: 0)
        saved = Array(saved.prefix(30))
        persist()
    }

    /// A new trip from the form: counts toward the free five.
    func planNew(_ r: TripRequest) {
        tripsPlanned += 1
        defaults.set(tripsPlanned, forKey: "tripsPlanned")
        save(r)
    }

    func delete(_ r: TripRequest) {
        saved.removeAll { $0.id == r.id }
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(saved) { defaults.set(data, forKey: Self.key) }
    }
}
