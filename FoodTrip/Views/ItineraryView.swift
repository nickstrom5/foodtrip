import SwiftUI

/// The plan: a section a day, a row a meal, with reserve, directions, calendar and swap on each.
struct ItineraryView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State var request: TripRequest
    @State private var swapping: SwapTarget?
    @State private var notice: Notice?

    struct SwapTarget: Identifiable { let day: Int; let slot: Slot; var id: String { "\(day)-\(slot.rawValue)" } }
    struct Notice: Identifiable { let id = UUID(); let title: String; let message: String }

    private var city: City? { model.city(request.cityID) }
    private var plan: TripPlan? { model.plan(request) }

    var body: some View {
        Group {
            if let city, let plan {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(plan.days.count) day\(plan.days.count == 1 ? "" : "s") of eating in \(city.name)")
                                .font(.title2.bold())
                            Text(summary(plan)).foregroundStyle(.secondary)
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
                    }
                    ForEach(plan.days) { day in
                        Section {
                            ForEach(day.stops) { stop in
                                StopRow(stop: stop, day: day, city: city, party: request.party,
                                        onCalendar: { addToCalendar([(stop, day)], city: city) },
                                        onSwap: { swapping = SwapTarget(day: day.index, slot: stop.slot) })
                            }
                            if !day.missing.isEmpty {
                                Text("No \(day.missing.map { $0.label.lowercased() }.joined(separator: " or ")) pick left in \(city.name) for this day.")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                        } header: {
                            Text("Day \(day.index + 1) · \(Format.long(day.date))")
                        } footer: {
                            if day.over {
                                Text("About $\(day.spent) a person, $\(day.spent - plan.budget) over budget").foregroundStyle(.red)
                            } else {
                                Text("About $\(day.spent) a person")
                            }
                        }
                    }
                    Section {
                    } footer: {
                        Text("Prices are estimates for food, tax and tip, per person. Times are a suggestion: book, then edit the calendar event to match. Places change, so check hours before you go.\n\nRestaurant data from Eats Ranked: public records, MICHELIN Guide and James Beard Foundation honors. FoodTrip is not affiliated with OpenTable, the MICHELIN Guide or the James Beard Foundation.")
                    }
                }
                .toolbar {
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        ShareLink(item: request.shareURL, subject: Text("FoodTrip: \(city.name)"), message: Text("Our food plan for \(city.name)")) {
                            Label("Share plan", systemImage: "square.and.arrow.up")
                        }
                        Menu {
                            Button { addToCalendar(plan.days.flatMap { d in d.stops.map { ($0, d) } }, city: city) } label: {
                                Label("Add all to calendar", systemImage: "calendar.badge.plus")
                            }
                            Button { shuffle() } label: { Label("Shuffle the plan", systemImage: "shuffle") }
                        } label: {
                            Label("More", systemImage: "ellipsis.circle")
                        }
                        .accessibilityIdentifier("moreMenu")
                    }
                }
                .sheet(item: $swapping) { target in
                    SwapSheet(city: city, plan: plan, target: target) { place in swap(target, to: place, in: plan) }
                        .presentationDetents([.medium, .large])
                }
            } else {
                ContentUnavailableView("Trip not available", systemImage: "fork.knife", description: Text("This city is no longer in FoodTrip's data."))
            }
        }
        #if DEBUG
        .onAppear { if UserDefaults.standard.string(forKey: "screen") == "swap", swapping == nil { swapping = SwapTarget(day: 0, slot: .dinner) } }
        #endif
        .navigationTitle(city?.name ?? "Trip")
        .navigationBarTitleDisplayMode(.inline)
        .alert(item: $notice) { n in Alert(title: Text(n.title), message: Text(n.message), dismissButton: .default(Text("OK"))) }
    }

    private func summary(_ plan: TripPlan) -> String {
        let dates = plan.days.count > 1 ? "\(Format.short(plan.start)) – \(Format.short(plan.end))" : Format.short(plan.start)
        let forParty = request.party > 1 ? ", $\((plan.total * request.party).formatted()) for \(request.party)" : ""
        return "\(dates) · about $\(plan.total.formatted()) a person\(forParty)"
    }

    private func shuffle() {
        request.seed = request.seed % 9999 + 1
        request.locked = [:]
        model.save(request)
    }

    /// Lock every stop where it is, then change the one: the rest of the plan stays put.
    private func swap(_ target: SwapTarget, to place: Place, in plan: TripPlan) {
        var locked: [String: String] = [:]
        for d in plan.days { for s in d.stops { locked["\(d.index)-\(s.slot.rawValue)"] = s.place.id } }
        locked[target.id] = place.id
        request.locked = locked
        model.save(request)
        swapping = nil
    }

    private func addToCalendar(_ stops: [(Stop, DayPlan)], city: City) {
        Task {
            do {
                let n = try await CalendarService.add(stops, city: city, party: request.party)
                notice = Notice(title: "Added to your calendar", message: n == 1 ? "\(stops[0].0.slot.label) at \(stops[0].0.place.n) is on your calendar." : "\(n) meals are on your calendar, at \(city.name) time.")
            } catch {
                notice = Notice(title: "Couldn't add to calendar", message: error.localizedDescription)
            }
        }
    }
}

private struct StopRow: View {
    @Environment(\.openURL) private var openURL
    let stop: Stop
    let day: DayPlan
    let city: City
    let party: Int
    let onCalendar: () -> Void
    let onSwap: () -> Void

    private var place: Place { stop.place }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(Format.time(stop.slot.time)).font(.subheadline.bold()).monospacedDigit()
                Text(stop.slot.label.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Text("~$\(stop.cost)").font(.subheadline).foregroundStyle(.secondary).monospacedDigit()
            }
            Text(place.n).font(.title3.bold())
            Text([place.cu, place.priceLabel, place.hd].compactMap { $0 }.joined(separator: " · "))
                .font(.subheadline).foregroundStyle(.secondary)
            Text(place.hl)
                .font(.caption.weight(.bold))
                .padding(.horizontal, 9).padding(.vertical, 3)
                .background(place.isMichelin ? Color.yellow.opacity(0.22) : Color.green.opacity(0.16), in: Capsule())
                .foregroundStyle(place.isMichelin ? Color("Gold") : Color("Herb"))
            if let w = place.w {
                Text(w).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 8) {
                if Links.needsBooking(stop), let url = Links.reserve(stop, day: day, city: city, party: party) {
                    Button("Reserve for \(party)") { openURL(url) }
                        .buttonStyle(.borderedProminent)
                        .accessibilityIdentifier("reserve-\(day.index)-\(stop.slot.rawValue)")
                } else {
                    Text("Walk in").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Menu {
                    if let url = Links.directions(place, city: city) {
                        Button { openURL(url) } label: { Label("Directions", systemImage: "map") }
                    }
                    Button(action: onCalendar) { Label("Add to calendar", systemImage: "calendar.badge.plus") }
                    if Links.needsBooking(stop), let url = Links.otherWays(place, city: city) {
                        Button { openURL(url) } label: { Label("Other ways to book", systemImage: "magnifyingglass") }
                    }
                } label: {
                    Label("More", systemImage: "ellipsis").labelStyle(.iconOnly).frame(minWidth: 28, minHeight: 20)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("More for \(place.n)")
                Button("Swap", action: onSwap)
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("swap-\(day.index)-\(stop.slot.rawValue)")
            }
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .padding(.top, 2)
        }
        .padding(.vertical, 4)
    }
}

private struct SwapSheet: View {
    @Environment(\.dismiss) private var dismiss
    let city: City
    let plan: TripPlan
    let target: ItineraryView.SwapTarget
    let onPick: (Place) -> Void

    var body: some View {
        let options = Planner.alternatives(city: city, plan: plan, day: target.day, slot: target.slot, count: 8)
        NavigationStack {
            List(options) { p in
                Button { onPick(p) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(p.n).font(.headline).foregroundStyle(.primary)
                        Text("\(p.cu) · \(p.priceLabel) · ~$\(target.slot.cost(p))\(p.hd.map { " · \($0)" } ?? "")").font(.subheadline).foregroundStyle(.secondary)
                        Text(p.hl).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .overlay {
                if options.isEmpty {
                    ContentUnavailableView("Nothing else to swap in", systemImage: "fork.knife", description: Text("Every other \(target.slot.label.lowercased()) pick in \(city.name) is already in your plan."))
                }
            }
            .navigationTitle("Swap \(target.slot.label.lowercased())")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
