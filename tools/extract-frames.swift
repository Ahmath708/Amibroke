// extract-frames.swift — dump PNG frames from a video via AVFoundation.
// Used by tools/sim-record.sh to turn a simulator screen recording into
// frame-by-frame stills (no ffmpeg needed).
//
// usage: swift extract-frames.swift <video> <outdir> [fps] [maxSeconds]
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 3 else {
    FileHandle.standardError.write("usage: extract-frames.swift <video> <outdir> [fps] [maxSeconds]\n".data(using: .utf8)!)
    exit(1)
}
let videoPath = a[1]
let outDir = a[2]
let fps = a.count > 3 ? (Double(a[3]) ?? 8) : 8
let maxSeconds = a.count > 4 ? (Double(a[4]) ?? 15) : 15

let asset = AVURLAsset(url: URL(fileURLWithPath: videoPath))
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let interval = 1.0 / fps
var times: [NSValue] = []
var t = 0.0
while t < maxSeconds { times.append(NSValue(time: CMTime(seconds: t, preferredTimescale: 600))); t += interval }

let sem = DispatchSemaphore(value: 0)
let lock = NSLock()
var got: [(Double, CGImage)] = []
var remaining = times.count
gen.generateCGImagesAsynchronously(forTimes: times) { requested, cg, _, result, _ in
    lock.lock()
    if let cg = cg, result == .succeeded { got.append((CMTimeGetSeconds(requested), cg)) }
    remaining -= 1
    let done = remaining == 0
    lock.unlock()
    if done { sem.signal() }
}
sem.wait()

got.sort { $0.0 < $1.0 }
for (i, pair) in got.enumerated() {
    let out = URL(fileURLWithPath: outDir).appendingPathComponent(String(format: "frame-%03d.png", i))
    if let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.png.identifier as CFString, 1, nil) {
        CGImageDestinationAddImage(dest, pair.1, nil)
        CGImageDestinationFinalize(dest)
    }
}
print("extracted \(got.count) frames, \(String(format: "%.0f", fps))fps (frame N ≈ N/\(String(format: "%.0f", fps))s)")
