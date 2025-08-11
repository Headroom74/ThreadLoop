import Foundation
import Capacitor
import AVFoundation

@objc(NativeAudioLooper)
public class NativeAudioLooper: CAPPlugin {
    private let impl = NativeAudioLooperImpl()

    @objc func loadAudio(_ call: CAPPluginCall) {
        if let path = call.getString("path") {
            impl.loadAudioFromPath(path: path) { result in
                switch result {
                case .success(let duration): call.resolve(["duration": duration])
                case .failure(let err): call.reject(err.localizedDescription)
                }
            }
        } else if let base64 = call.getString("base64") {
            impl.loadAudioFromBase64(base64: base64) { result in
                switch result {
                case .success(let duration): call.resolve(["duration": duration])
                case .failure(let err): call.reject(err.localizedDescription)
                }
            }
        } else {
            call.reject("Expected { path: string } or { base64: string }")
        }
    }

    @objc func setLoopPoints(_ call: CAPPluginCall) {
        guard let start = call.getDouble("start"),
              let end = call.getDouble("end") else {
            call.reject("Missing start/end")
            return
        }
        impl.setLoopPoints(start: start, end: end)
        call.resolve()
    }

    @objc func setRate(_ call: CAPPluginCall) {
        let rate = call.getDouble("rate") ?? 1.0
        impl.setRate(rate: rate)
        call.resolve()
    }

    @objc func setPitch(_ call: CAPPluginCall) {
        let semitones = call.getDouble("semitones") ?? 0.0
        impl.setPitch(semitones: semitones)
        call.resolve()
    }

    @objc func play(_ call: CAPPluginCall) {
        impl.play()
        call.resolve()
    }

    @objc func pause(_ call: CAPPluginCall) {
        impl.pause()
        call.resolve()
    }

    @objc func seek(_ call: CAPPluginCall) {
        guard let time = call.getDouble("time") else {
            call.reject("Missing time")
            return
        }
        impl.seek(time: time)
        call.resolve()
    }

    @objc func getCurrentTime(_ call: CAPPluginCall) {
        call.resolve(["time": impl.getCurrentTime()])
    }
}

class NativeAudioLooperImpl {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let timePitch = AVAudioUnitTimePitch()

    private var audioFile: AVAudioFile?
    private var audioFormat: AVAudioFormat?
    private var sampleRate: Double = 44100.0

    private var loopStartSec: Double = 0.0
    private var loopEndSec: Double = 0.0
    private var crossfadeMs: Double = 8.0
    private var isPlaying: Bool = false

    private let schedulingQueue = DispatchQueue(label: "ThreadLoopScheduling")

    init() {
        engine.attach(player)
        engine.attach(timePitch)

        engine.connect(player, to: timePitch, format: nil)
        engine.connect(timePitch, to: engine.mainMixerNode, format: nil)

        timePitch.rate = 1.0
        timePitch.pitch = 0.0

        do { try engine.start() } catch { print("Engine start error: \(error)") }

        NotificationCenter.default.addObserver(self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance())
    }

    func loadAudioFromPath(path: String, completion: @escaping (Result<Double,Error>) -> Void) {
        schedulingQueue.async {
            do {
                let url = self.resolveURL(path: path)
                let file = try AVAudioFile(forReading: url)
                self.audioFile = file
                self.audioFormat = file.processingFormat
                self.sampleRate = file.processingFormat.sampleRate
                let duration = Double(file.length) / self.sampleRate
                completion(.success(duration))
            } catch { completion(.failure(error)) }
        }
    }

    func loadAudioFromBase64(base64: String, completion: @escaping (Result<Double,Error>) -> Void) {
        schedulingQueue.async {
            do {
                guard let data = Data(base64Encoded: base64) else {
                    throw NSError(domain: "NativeAudioLooper", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid base64"])
                }
                let tmpURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("threadloop.m4a")
                try data.write(to: tmpURL)
                let file = try AVAudioFile(forReading: tmpURL)
                self.audioFile = file
                self.audioFormat = file.processingFormat
                self.sampleRate = file.processingFormat.sampleRate
                let duration = Double(file.length) / self.sampleRate
                completion(.success(duration))
            } catch { completion(.failure(error)) }
        }
    }

    func setLoopPoints(start: Double, end: Double) {
        loopStartSec = max(0.0, start)
        loopEndSec = max(loopStartSec, end)
        if isPlaying { scheduleNextCycle(interrupt: true) }
    }

    func setRate(rate: Double) { timePitch.rate = max(0.5, min(2.0, Float(rate))) }
    func setPitch(semitones: Double) { timePitch.pitch = Float(semitones * 100.0) }

    func play() {
        if isPlaying { return }
        isPlaying = true
        if !engine.isRunning { try? engine.start() }
        scheduleNextCycle(interrupt: true)
        player.play()
    }

    func pause() {
        isPlaying = false
        player.pause()
    }

    func seek(time: Double) {
        let t = max(0.0, time)
        scheduleAt(timeSec: t)
    }

    func getCurrentTime() -> Double {
        guard let nodeTime = player.lastRenderTime,
              let playerTime = player.playerTime(forNodeTime: nodeTime) else { return loopStartSec }
        let seconds = Double(playerTime.sampleTime) / sampleRate / Double(timePitch.rate == 0 ? 1 : timePitch.rate)
        return seconds
    }

    private func scheduleNextCycle(interrupt: Bool) {
        guard let file = audioFile else { return }
        let startFrame = AVAudioFramePosition(loopStartSec * sampleRate)
        let endFrame = AVAudioFramePosition(loopEndSec * sampleRate)
        let totalFrames = endFrame - startFrame
        if totalFrames <= 0 { return }

        let cfFrames = AVAudioFrameCount(max(1, Int((crossfadeMs / 1000.0) * sampleRate)))
        let mainFrames = AVAudioFrameCount(max(0, Int(totalFrames) - Int(cfFrames)))

        schedulingQueue.async {
            if interrupt { self.player.stop() }
            if mainFrames > 0 {
                try? self.player.scheduleSegment(file, startingFrame: startFrame, frameCount: mainFrames, at: nil, completionHandler: nil)
            }
            if let xfade = self.makeCrossfadeBuffer(file: file, startFrame: startFrame, endFrame: endFrame, crossfadeFrames: cfFrames) {
                self.player.scheduleBuffer(xfade, at: nil, options: [], completionHandler: { [weak self] in
                    guard let self = self else { return }
                    if self.isPlaying { self.scheduleNextCycle(interrupt: false) }
                })
            }
        }
    }

    private func scheduleAt(timeSec: Double) {
        guard let file = audioFile else { return }
        let t = min(max(timeSec, loopStartSec), loopEndSec)
        let startFrame = AVAudioFramePosition(t * sampleRate)
        let endFrame = AVAudioFramePosition(loopEndSec * sampleRate)
        let cfFrames = AVAudioFrameCount(max(1, Int((crossfadeMs / 1000.0) * sampleRate)))
        let framesToEnd = AVAudioFrameCount(max(0, Int(endFrame - startFrame) - Int(cfFrames)))

        schedulingQueue.async {
            self.player.stop()
            if framesToEnd > 0 {
                try? self.player.scheduleSegment(file, startingFrame: startFrame, frameCount: framesToEnd, at: nil, completionHandler: nil)
            }
            if let xfade = self.makeCrossfadeBuffer(file: file,
                                                    startFrame: AVAudioFramePosition(self.loopStartSec * self.sampleRate),
                                                    endFrame: AVAudioFramePosition(self.loopEndSec * self.sampleRate),
                                                    crossfadeFrames: cfFrames) {
                self.player.scheduleBuffer(xfade, at: nil, options: [], completionHandler: { [weak self] in
                    self?.scheduleNextCycle(interrupt: false)
                })
            }
            self.player.play()
            self.isPlaying = true
        }
    }

    private func makeCrossfadeBuffer(file: AVAudioFile,
                                     startFrame: AVAudioFramePosition,
                                     endFrame: AVAudioFramePosition,
                                     crossfadeFrames: AVAudioFrameCount) -> AVAudioPCMBuffer? {
        guard let format = audioFormat else { return nil }
        let cf = Int(crossfadeFrames)
        if cf <= 0 { return nil }

        guard let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(cf)) else { return nil }
        buf.frameLength = AVAudioFrameCount(cf)

        let endStart = max(endFrame - AVAudioFramePosition(cf), 0)
        guard let endBuf = readFrames(file: file, start: endStart, count: cf) else { return nil }
        guard let startBuf = readFrames(file: file, start: startFrame, count: cf) else { return nil }

        let channels = Int(format.channelCount)
        for ch in 0..<channels {
            let endPtr = endBuf.floatChannelData![ch]
            let startPtr = startBuf.floatChannelData![ch]
            let outPtr = buf.floatChannelData![ch]
            for i in 0..<cf {
                let x = Float(i) / Float(max(cf-1, 1))
                let a = cosf(Float.pi * 0.5 * x)
                let b = sinf(Float.pi * 0.5 * x)
                outPtr[i] = endPtr[i] * a * a + startPtr[i] * b * b
            }
        }
        return buf
    }

    private func readFrames(file: AVAudioFile, start: AVAudioFramePosition, count: Int) -> AVAudioPCMBuffer? {
        guard let format = audioFormat else { return nil }
        do {
            try file.framePosition = start
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)) else { return nil }
            try file.read(into: buffer, frameCount: AVAudioFrameCount(count))
            return buffer
        } catch {
            print("readFrames error: \(error)")
            return nil
        }
    }

    private func resolveURL(path: String) -> URL {
        if path.hasPrefix("file://") { return URL(string: path)! }
        if path.hasPrefix("/") { return URL(fileURLWithPath: path) }
        if let url = Bundle.main.url(forResource: path, withExtension: nil) { return url }
        return URL(fileURLWithPath: path)
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        if type == .began { pause() }
    }
}
