import XCTest
@testable import FoodTrip

final class PlannerTests: XCTestCase {
    private let file = CityFile.load(bundle: Bundle(for: AppModel.self))

    struct Vector: Decodable {
        struct Opts: Decodable { let start: String; let end: String; let meals: Int; let budget: Int; let seed: Int }
        let city: String
        let opts: Opts
        let days: [[String]]
    }

    func testBundledDataLoads() {
        XCTAssertGreaterThanOrEqual(file.cities.count, 30)
        XCTAssertNotNil(file.cities.first { $0.id == "chicago-il" })
        for c in file.cities {
            XCTAssertGreaterThanOrEqual(c.places.count, 19, c.id)      // MIN_PICKS in scripts/build-cities.py
            XCTAssertNotNil(TimeZone(identifier: c.tz), c.id)
        }
    }

    /// The app must give exactly the plan the website gives (scripts/planner-vectors.json, from docs/planner.js).
    func testMatchesTheWebsitePlanner() throws {
        let url = try XCTUnwrap(Bundle(for: PlannerTests.self).url(forResource: "planner-vectors", withExtension: "json"))
        let vectors = try JSONDecoder().decode([Vector].self, from: Data(contentsOf: url))
        XCTAssertFalse(vectors.isEmpty)
        for v in vectors {
            let city = try XCTUnwrap(file.cities.first { $0.id == v.city })
            let plan = Planner.plan(city: city, start: v.opts.start, end: v.opts.end, meals: v.opts.meals, budget: v.opts.budget, seed: v.opts.seed)
            let got = plan.days.map { $0.stops.map { "\($0.slot.rawValue):\($0.place.id)" } }
            XCTAssertEqual(got, v.days, "\(v.city) meals \(v.opts.meals) budget \(v.opts.budget)")
        }
    }

    func testNoRepeatsAndTheMealsAskedFor() throws {
        for city in file.cities {
            let plan = Planner.plan(city: city, start: "2026-12-04", end: "2026-12-06", meals: 3, budget: 150, seed: 5)
            XCTAssertEqual(plan.days.count, 3)
            let ids = plan.days.flatMap { $0.stops.map(\.place.id) }
            XCTAssertEqual(Set(ids).count, ids.count, city.id)
            for d in plan.days { for s in d.stops { XCTAssertNotEqual(s.place.m & s.slot.bit, 0, "\(city.id) \(s.place.n)") } }
        }
    }

    func testSwapKeepsTheRestOfThePlan() throws {
        let city = try XCTUnwrap(file.cities.first { $0.id == "chicago-il" })
        let plan = Planner.plan(city: city, start: "2026-12-04", end: "2026-12-05", meals: 3, budget: 150, seed: 3)
        let alt = try XCTUnwrap(Planner.alternatives(city: city, plan: plan, day: 0, slot: .dinner, count: 3).first)
        XCTAssertFalse(plan.days.flatMap(\.stops).contains { $0.place.id == alt.id })
        var locked: [String: String] = [:]
        for d in plan.days { for s in d.stops { locked["\(d.index)-\(s.slot.rawValue)"] = s.place.id } }
        locked["0-dinner"] = alt.id
        let next = Planner.plan(city: city, start: "2026-12-04", end: "2026-12-05", meals: 3, budget: 150, seed: 3, locked: locked)
        XCTAssertEqual(next.days[0].stops.first { $0.slot == .dinner }?.place.id, alt.id)
        let before = plan.days.flatMap(\.stops).filter { !($0.slot == .dinner && plan.days[0].stops.contains($0)) }.map(\.place.id)
        let after = next.days.flatMap(\.stops).map(\.place.id)
        for id in before { XCTAssertTrue(after.contains(id)) }
    }

    func testDays() {
        XCTAssertEqual(Day.count(from: "2026-12-04", to: "2026-12-06"), 3)
        XCTAssertEqual(Day.count(from: "2026-12-04", to: "2026-12-04"), 1)
        XCTAssertEqual(Day.count(from: "2026-12-04", to: "2027-03-01"), 14)
        XCTAssertEqual(Day.add("2026-12-30", 3), "2027-01-02")
        // 7 PM in Chicago in December is 01:00 UTC the next day
        let t = Day.instant("2026-12-04", time: "19:00", zone: TimeZone(identifier: "America/Chicago")!)
        XCTAssertEqual(ISO8601DateFormatter().string(from: t), "2026-12-05T01:00:00Z")
    }

    func testShareLinkCarriesTheTrip() {
        var r = TripRequest(cityID: "austin-tx", start: "2026-12-04", end: "2026-12-06", meals: 4, budget: 200, party: 4, seed: 2)
        XCTAssertEqual(r.shareURL.absoluteString, "https://getfoodtrip.app/#c=austin-tx&s=2026-12-04&e=2026-12-06&m=4&b=200&n=4&r=2")
        r.locked = ["0-dinner": "tx-abc"]
        XCTAssertTrue(r.shareURL.absoluteString.contains("lk=0-dinner:tx-abc"))
    }

    func testFiveFreeTripsThenThePaywall() {
        let defaults = UserDefaults(suiteName: "foodtrip.tests.\(UUID().uuidString)")!
        let model = AppModel(file: file, defaults: defaults)
        XCTAssertEqual(model.freeTripsLeft, 5)
        for i in 0..<5 {
            XCTAssertGreaterThan(model.freeTripsLeft, 0)
            var r = TripRequest(cityID: "chicago-il", start: "2026-12-04", end: "2026-12-05")
            model.planNew(r)
            // a swap or a shuffle saves the same trip again and uses nothing
            r.seed = 9
            model.save(r)
            XCTAssertEqual(model.tripsPlanned, i + 1)
        }
        XCTAssertEqual(model.freeTripsLeft, 0)
        XCTAssertEqual(model.saved.count, 5)
        // the count survives a relaunch
        XCTAssertEqual(AppModel(file: file, defaults: defaults).freeTripsLeft, 0)
    }
}
