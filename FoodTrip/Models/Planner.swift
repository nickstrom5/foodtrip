import Foundation

// FoodTrip planner. This is docs/planner.js in Swift: change one, change the other. PlannerTests checks this file against
// scripts/planner-vectors.json (written by `node scripts/test-planner.mjs`), so the app and the website give the same plan
// for the same city, dates, meals, budget and seed. That is what makes a shared link open to the same trip.

enum Slot: String, Codable, CaseIterable, Hashable {
    case breakfast, lunch, snack, dinner

    var bit: Int { switch self { case .breakfast: 1; case .lunch: 2; case .dinner: 4; case .snack: 8 } }
    var label: String { switch self { case .breakfast: "Breakfast"; case .lunch: "Lunch"; case .snack: "Afternoon treat"; case .dinner: "Dinner" } }
    /// suggested start, 24-hour "HH:mm" in the city's own time
    var time: String { switch self { case .breakfast: "09:00"; case .lunch: "12:30"; case .snack: "15:30"; case .dinner: "19:00" } }
    var minutes: Int { switch self { case .breakfast: 60; case .lunch: 75; case .snack: 30; case .dinner: 120 } }
    /// estimated cost per person by price tier (food, tax and tip; no drinks)
    var costs: [Int] {
        switch self {
        case .breakfast: [0, 14, 26, 45, 70]
        case .lunch: [0, 16, 32, 60, 110]
        case .snack: [0, 8, 14, 22, 30]
        case .dinner: [0, 20, 45, 90, 220]
        }
    }
    func cost(_ p: Place) -> Int { (1...4).contains(p.p) ? costs[p.p] : costs[2] }
}

struct Stop: Identifiable, Hashable {
    let slot: Slot
    let place: Place
    let cost: Int
    var id: String { place.id }
}

struct DayPlan: Identifiable, Hashable {
    let index: Int
    /// "yyyy-MM-dd"
    let date: String
    let stops: [Stop]
    let spent: Int
    let over: Bool
    let missing: [Slot]
    var id: Int { index }
}

struct TripPlan: Hashable {
    let days: [DayPlan]
    let total: Int
    let budget: Int
    var start: String { days.first?.date ?? "" }
    var end: String { days.last?.date ?? "" }
}

enum Planner {
    /// meals per day -> which slots
    static func slots(meals: Int) -> [Slot] {
        switch meals {
        case 1: [.dinner]
        case 2: [.lunch, .dinner]
        case 4: [.breakfast, .lunch, .snack, .dinner]
        default: [.breakfast, .lunch, .dinner]
        }
    }
    /// the order slots are filled in: the big meal first, so the budget goes where it matters
    static let fill: [Slot] = [.dinner, .lunch, .breakfast, .snack]

    /// mulberry32, the same sequence as planner.js
    struct Random {
        var a: UInt32
        mutating func next() -> Double {
            a = a &+ 0x6D2B79F5
            var t = a
            t = (t ^ (t >> 15)) &* (t | 1)
            t ^= t &+ ((t ^ (t >> 7)) &* (t | 61))
            return Double(t ^ (t >> 14)) / 4294967296
        }
    }

    static func km(_ a: Place, _ b: Place) -> Double {
        let R = 6371.0, r = Double.pi / 180
        let dLa = (b.la - a.la) * r, dLo = (b.lo - a.lo) * r
        let x = pow(sin(dLa / 2), 2) + cos(a.la * r) * cos(b.la * r) * pow(sin(dLo / 2), 2)
        return 2 * R * asin(sqrt(x))
    }

    static func plan(city: City, start: String, end: String, meals: Int, budget rawBudget: Int, seed: Int, locked: [String: String] = [:]) -> TripPlan {
        let days = Day.count(from: start, to: end)
        let slots = slots(meals: meals)
        let budget = max(10, rawBudget)
        var rand = Random(a: UInt32(truncatingIfNeeded: seed == 0 ? 1 : seed))
        var byId: [String: Place] = [:]
        var jitter: [String: Double] = [:]
        for p in city.places { byId[p.id] = p; jitter[p.id] = rand.next() * 14 }
        var used = Set(locked.values)
        var cuisineUses: [String: Int] = [:]
        var out: [DayPlan] = []

        // the least the meals after this one can cost: the cheapest free place for each, a different place per slot
        func reserve(for rest: ArraySlice<Slot>) -> Int {
            var taken = Set<String>()
            var total = 0
            for slot in rest {
                var best: Place?
                for p in city.places where p.m & slot.bit != 0 && !used.contains(p.id) && !taken.contains(p.id) {
                    if best == nil || slot.cost(p) < slot.cost(best!) { best = p }
                }
                if let best { taken.insert(best.id); total += slot.cost(best) }
            }
            return total
        }

        for d in 0..<days {
            var stops: [Slot: Stop] = [:]
            var spent = 0
            var anchor: Place?
            var today = Set<String>()
            let order = fill.filter { slots.contains($0) }
            for (i, slot) in order.enumerated() {
                let left = budget - spent - reserve(for: order[(i + 1)...])
                let lockedId = locked["\(d)-\(slot.rawValue)"]
                var pick = lockedId.flatMap { byId[$0] }
                if pick == nil {
                    var best: Place?, bestScore = -Double.infinity, cheapest: Place?
                    for p in city.places where p.m & slot.bit != 0 && !used.contains(p.id) {
                        let c = slot.cost(p)
                        if let ch = cheapest {
                            let cc = slot.cost(ch)
                            if c < cc || (c == cc && p.r > ch.r) { cheapest = p }
                        } else { cheapest = p }
                        if c > left { continue }
                        var s = Double(p.r) + (jitter[p.id] ?? 0)
                        s -= 12 * Double(cuisineUses[p.cu] ?? 0)
                        if today.contains(p.cu) { s -= 25 }
                        if let anchor { s -= min(30, 2.5 * km(anchor, p)) }
                        // a splurge-sized budget should get a splurge: favour using what's there at dinner
                        if slot == .dinner { s += 6 * (Double(c) / Double(max(left, 1))) }
                        if s > bestScore { bestScore = s; best = p }
                    }
                    pick = best ?? cheapest
                }
                guard let pick else { continue }
                used.insert(pick.id)
                today.insert(pick.cu)
                cuisineUses[pick.cu, default: 0] += 1
                let c = slot.cost(pick)
                spent += c
                if anchor == nil { anchor = pick }
                stops[slot] = Stop(slot: slot, place: pick, cost: c)
            }
            out.append(DayPlan(index: d, date: Day.add(start, d), stops: Slot.allCases.compactMap { stops[$0] }, spent: spent,
                               over: spent > budget, missing: slots.filter { stops[$0] == nil }))
        }
        return TripPlan(days: out, total: out.reduce(0) { $0 + $1.spent }, budget: budget)
    }

    /// the next-best places for one stop, keeping the rest of the plan
    static func alternatives(city: City, plan: TripPlan, day dayIndex: Int, slot: Slot, count: Int = 5) -> [Place] {
        let used = Set(plan.days.flatMap { $0.stops.map(\.place.id) })
        guard plan.days.indices.contains(dayIndex) else { return [] }
        let others = plan.days[dayIndex].stops.filter { $0.slot != slot }
        let left = plan.budget - others.reduce(0) { $0 + $1.cost }
        let anchor = others.last?.place
        var scored: [(place: Place, score: Double)] = []
        for p in city.places where p.m & slot.bit != 0 && !used.contains(p.id) {
            var s = Double(p.r)
            if slot.cost(p) > left { s -= 40 }
            if let anchor { s -= min(30, 2.5 * km(anchor, p)) }
            scored.append((p, s))
        }
        scored.sort { a, b in a.score != b.score ? a.score > b.score : a.place.id < b.place.id }
        return scored.prefix(count).map(\.place)
    }
}

/// Calendar days as "yyyy-MM-dd" strings, the same arithmetic as planner.js (UTC, so no daylight-saving surprises).
enum Day {
    static let utc: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c }()
    static let format: DateFormatter = {
        let f = DateFormatter(); f.calendar = utc; f.timeZone = utc.timeZone; f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    static func date(_ iso: String) -> Date { format.date(from: iso) ?? Date(timeIntervalSince1970: 0) }
    static func iso(_ d: Date) -> String { format.string(from: d) }
    /// the device-calendar day of a picked Date, as an ISO day
    static func iso(local d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 2026, c.month ?? 1, c.day ?? 1)
    }
    /// noon on that day in the device's calendar (safe for DatePicker round trips)
    static func local(_ iso: String) -> Date {
        let p = iso.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return Date() }
        return Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) ?? Date()
    }
    static func count(from start: String, to end: String) -> Int {
        let n = utc.dateComponents([.day], from: date(start), to: date(end)).day ?? 0
        return max(1, min(14, n + 1))
    }
    static func add(_ iso: String, _ n: Int) -> String { self.iso(utc.date(byAdding: .day, value: n, to: date(iso)) ?? date(iso)) }
    /// a wall-clock time on that day in a city's time zone
    static func instant(_ iso: String, time: String, zone: TimeZone) -> Date {
        let p = iso.split(separator: "-").compactMap { Int($0) }, t = time.split(separator: ":").compactMap { Int($0) }
        var c = Calendar(identifier: .gregorian); c.timeZone = zone
        guard p.count == 3, t.count == 2 else { return Date() }
        return c.date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: t[0], minute: t[1])) ?? Date()
    }
}
