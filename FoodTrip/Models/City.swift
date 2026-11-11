import Foundation

/// One restaurant, as scripts/build-cities.py writes it (short keys keep the bundled file small).
struct Place: Codable, Identifiable, Hashable {
    let id: String
    /// name
    let n: String
    /// street address
    let a: String
    let z: String
    let la: Double
    let lo: Double
    /// cuisine
    let cu: String
    /// price tier 1-4
    let p: Int
    /// 1 when the tier is our estimate
    let pe: Int
    /// meals it suits: 1 breakfast, 2 lunch, 4 dinner, 8 snack
    let m: Int
    /// the honor line ("1 MICHELIN Star", "Bib Gourmand", "James Beard winner", "Eats Ranked pick")
    let hl: String
    /// why go: a dish or a line about the place
    let w: String?
    /// rank, higher is better
    let r: Int
    /// neighborhood
    let hd: String?

    var priceLabel: String { String(repeating: "$", count: max(1, min(4, p))) }
    var isMichelin: Bool { hl.contains("MICHELIN") || hl.contains("Bib") }
}

struct City: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let st: String
    let tz: String
    let count: Int
    let places: [Place]

    var title: String { "\(name), \(st)" }
    var zone: TimeZone { TimeZone(identifier: tz) ?? .current }
    func address(_ p: Place) -> String { [p.a, name, st, p.z].filter { !$0.isEmpty }.joined(separator: ", ") }

    static func == (a: City, b: City) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

struct CityFile: Codable {
    let generated: String
    let cities: [City]

    static func load(bundle: Bundle = .main) -> CityFile {
        guard let url = bundle.url(forResource: "cities", withExtension: "json"), let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(CityFile.self, from: data) else { return CityFile(generated: "", cities: []) }
        return file
    }
}
