#!/usr/bin/env python3
"""Writes the asset catalog's JSON (colors and the icon slot) and the privacy manifest. Run from foodtrip/."""
import json
import os

X = "FoodTrip/Assets.xcassets"


def put(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


def color(hexv):
    return {"color-space": "srgb", "components": {"red": f"0x{hexv[0:2]}", "green": f"0x{hexv[2:4]}", "blue": f"0x{hexv[4:6]}", "alpha": "1.000"}}


def colorset(name, light, dark):
    put(f"{X}/{name}.colorset/Contents.json", {
        "info": {"author": "xcode", "version": 1},
        "colors": [
            {"idiom": "universal", "color": color(light)},
            {"idiom": "universal", "appearances": [{"appearance": "luminosity", "value": "dark"}], "color": color(dark)},
        ],
    })


put(f"{X}/Contents.json", {"info": {"author": "xcode", "version": 1}})
colorset("AccentColor", "D9472B", "F0684B")     # tomato: the site's --accent
colorset("Gold", "8A5A00", "F2C46B")            # MICHELIN badges
colorset("Herb", "2F6B4F", "7CC39D")            # every other badge
put(f"{X}/AppIcon.appiconset/Contents.json", {
    "info": {"author": "xcode", "version": 1},
    "images": [{"filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
})

PRIVACY = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyTrackingDomains</key>
	<array/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>CA92.1</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
"""
with open("FoodTrip/PrivacyInfo.xcprivacy", "w") as f:
    f.write(PRIVACY)
print("assets written")
