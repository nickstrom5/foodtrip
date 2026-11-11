// Draws FoodTrip's app icon (a map pin with a fork and knife on tomato red) and the site's icons.
//   swift scripts/make-brand.swift        (run from the foodtrip/ folder)
import AppKit

func icon(_ size: Int, rounded: Bool) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                               isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    let s = CGFloat(size) / 64
    // the artwork is drawn in a 64-point box with y down, like the site's SVG
    ctx.translateBy(x: 0, y: CGFloat(size)); ctx.scaleBy(x: s, y: -s)
    let red = NSColor(srgbRed: 0xD9 / 255, green: 0x47 / 255, blue: 0x2B / 255, alpha: 1)
    let deep = NSColor(srgbRed: 0xB5 / 255, green: 0x36 / 255, blue: 0x1D / 255, alpha: 1)
    let box = CGRect(x: 0, y: 0, width: 64, height: 64)
    if rounded { NSBezierPath(roundedRect: box, xRadius: 14, yRadius: 14).addClip() }
    NSGradient(starting: red, ending: deep)!.draw(in: box, angle: -90)

    // pin
    let pin = NSBezierPath()
    pin.move(to: CGPoint(x: 32, y: 53))
    pin.curve(to: CGPoint(x: 16, y: 26.5), controlPoint1: CGPoint(x: 32, y: 53), controlPoint2: CGPoint(x: 16, y: 38))
    pin.curve(to: CGPoint(x: 32, y: 11), controlPoint1: CGPoint(x: 16, y: 18), controlPoint2: CGPoint(x: 23.2, y: 11))
    pin.curve(to: CGPoint(x: 48, y: 26.5), controlPoint1: CGPoint(x: 40.8, y: 11), controlPoint2: CGPoint(x: 48, y: 18))
    pin.curve(to: CGPoint(x: 32, y: 53), controlPoint1: CGPoint(x: 48, y: 38), controlPoint2: CGPoint(x: 32, y: 53))
    pin.close()
    NSColor.white.setFill(); pin.fill()

    red.setFill()
    // fork: three tines, a neck and a handle
    for x in [26.0, 28.25, 30.5] { NSBezierPath(roundedRect: CGRect(x: x, y: 18, width: 1.5, height: 9), xRadius: 0.75, yRadius: 0.75).fill() }
    NSBezierPath(roundedRect: CGRect(x: 26, y: 25, width: 6, height: 5), xRadius: 2.5, yRadius: 2.5).fill()
    NSBezierPath(roundedRect: CGRect(x: 28, y: 27, width: 2, height: 12), xRadius: 1, yRadius: 1).fill()
    // knife: a blade and a handle
    let blade = NSBezierPath()
    blade.move(to: CGPoint(x: 38, y: 18))
    blade.curve(to: CGPoint(x: 34.5, y: 28), controlPoint1: CGPoint(x: 35.5, y: 19), controlPoint2: CGPoint(x: 34.5, y: 23))
    blade.line(to: CGPoint(x: 38, y: 30))
    blade.close(); blade.fill()
    NSBezierPath(roundedRect: CGRect(x: 36, y: 18, width: 2, height: 21), xRadius: 1, yRadius: 1).fill()

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

let root = FileManager.default.currentDirectoryPath
func write(_ data: Data, _ path: String) {
    let url = URL(fileURLWithPath: root).appendingPathComponent(path)
    try! FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try! data.write(to: url)
    print("wrote", path)
}
write(icon(1024, rounded: false), "FoodTrip/Assets.xcassets/AppIcon.appiconset/AppIcon.png")   // iOS rounds the corners itself
write(icon(180, rounded: false), "docs/apple-touch-icon.png")
write(icon(192, rounded: true), "docs/icon-192.png")
write(icon(512, rounded: true), "docs/icon-512.png")
write(icon(32, rounded: true), "docs/favicon-32.png")
