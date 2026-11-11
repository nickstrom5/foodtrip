import EventKit
import Foundation

/// Where a stop's buttons go. The same links the website uses.
enum Links {
    private static func url(_ base: String, _ items: [(String, String)]) -> URL? {
        var c = URLComponents(string: base)
        c?.queryItems = items.map { URLQueryItem(name: $0.0, value: $0.1) }
        return c?.url
    }

    /// OpenTable's search for this restaurant, with the date, time and party size filled in.
    static func reserve(_ stop: Stop, day: DayPlan, city: City, party: Int) -> URL? {
        url("https://www.opentable.com/s", [("term", "\(stop.place.n) \(city.name)"), ("covers", "\(party)"), ("dateTime", "\(day.date)T\(stop.slot.time)")])
    }

    /// A web search for the restaurant's own booking page (Resy, Tock, a phone number).
    static func otherWays(_ p: Place, city: City) -> URL? {
        url("https://www.google.com/search", [("q", "\(p.n) \(p.a) \(city.title) reservations")])
    }

    static func directions(_ p: Place, city: City) -> URL? {
        url("https://maps.apple.com/", [("q", p.n), ("ll", "\(p.la),\(p.lo)"), ("address", city.address(p))])
    }

    /// lunch and dinner at a sit-down price are worth booking; a bakery or a taco stand is a walk-in
    static func needsBooking(_ stop: Stop) -> Bool { (stop.slot == .dinner || stop.slot == .lunch) && stop.place.p >= 2 }
}

enum CalendarError: LocalizedError {
    case denied
    var errorDescription: String? { "FoodTrip can't add events. Allow calendar access for FoodTrip in Settings, then try again." }
}

/// Adds meals to the calendar with add-only access: FoodTrip never reads the calendar.
enum CalendarService {
    static let store = EKEventStore()

    static func event(for stop: Stop, day: DayPlan, city: City, party: Int) -> EKEvent {
        let e = EKEvent(eventStore: store)
        let start = Day.instant(day.date, time: stop.slot.time, zone: city.zone)
        e.title = "\(stop.slot.label): \(stop.place.n)"
        e.startDate = start
        e.endDate = start.addingTimeInterval(Double(stop.slot.minutes) * 60)
        e.timeZone = city.zone
        e.location = city.address(stop.place)
        var notes = [stop.place.hl, "\(stop.place.cu) · \(stop.place.priceLabel) · about $\(stop.cost) a person"]
        if let w = stop.place.w { notes.append(w) }
        if Links.needsBooking(stop), let u = Links.reserve(stop, day: day, city: city, party: party) { notes.append("Book: \(u.absoluteString)") }
        notes.append("Planned with FoodTrip · getfoodtrip.app")
        e.notes = notes.joined(separator: "\n")
        e.calendar = store.defaultCalendarForNewEvents
        return e
    }

    /// Returns how many events were added.
    @discardableResult
    static func add(_ stops: [(Stop, DayPlan)], city: City, party: Int) async throws -> Int {
        guard try await store.requestWriteOnlyAccessToEvents() else { throw CalendarError.denied }
        for (stop, day) in stops {
            try store.save(event(for: stop, day: day, city: city, party: party), span: .thisEvent, commit: false)
        }
        try store.commit()
        return stops.count
    }
}
