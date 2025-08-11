# NativeAudioLooper (Capacitor iOS Plugin)

After `npx cap add ios`, copy these files into your iOS target:

- `NativeAudioLooper.swift` → `ios/App/App/NativeAudioLooper.swift`
- `NativeAudioLooperPlugin.m` → `ios/App/App/NativeAudioLooperPlugin.m`

Then patch:

**AppDelegate.swift**
```swift
import AVFoundation
do {
  try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
  try AVAudioSession.sharedInstance().setActive(true)
} catch { print("AudioSession error: \(error)") }
```

**Info.plist**
```
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```
Then run:
```
npx cap sync ios
```
Build in Xcode or cloud CI and run on device.
