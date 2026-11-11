import SwiftUI

@main
struct FoodTripApp: App {
    @State private var model = AppModel()
    @State private var store = Store()

    var body: some Scene {
        WindowGroup {
            PlanFormView()
                .environment(model)
                .environment(store)
        }
    }
}
