// contact-sheet.swift — tile timestamped video frames into grid "contact sheets"
// for token-efficient motion review. Built on the same AVFoundation path as
// tools/extract-frames.swift (no ffmpeg needed).
//
// Scan a long recording cheaply: one sheet shows cols*rows frames with a
// "t=SS.s" label burned onto each, so a whole flow fits in a few images.
// For fine motion (easing curves, frame-by-frame), re-run over a short window
// at high fps with a small grid.
//
// usage: swift contact-sheet.swift <video> <outdir> [fps] [startSec] [maxSec] [cols] [rows] [thumbW]
//   fps      frames sampled per second        (default 1)
//   startSec offset to begin sampling         (default 0)
//   maxSec   seconds of footage to cover       (default = whole video)
//   cols/rows frames per sheet                  (default 6 x 4 = 24)
//   thumbW   thumbnail width in px             (default 200)
import Foundation
import AVFoundation
import AppKit

let a = CommandLine.arguments
guard a.count >= 3 else {
    FileHandle.standardError.write("usage: contact-sheet.swift <video> <outdir> [fps] [startSec] [maxSec] [cols] [rows] [thumbW]\n".data(using: .utf8)!)
    exit(1)
}
let videoPath = a[1]
let outDir = a[2]
let fps      = a.count > 3 ? (Double(a[3]) ?? 1) : 1
let startSec = a.count > 4 ? (Double(a[4]) ?? 0) : 0
let asset = AVURLAsset(url: URL(fileURLWithPath: videoPath))
let totalDur = CMTimeGetSeconds(asset.duration)
let maxSec   = a.count > 5 ? (Double(a[5]) ?? totalDur) : totalDur
let cols     = a.count > 6 ? (Int(a[6]) ?? 6) : 6
let rows     = a.count > 7 ? (Int(a[7]) ?? 4) : 4
let thumbW   = a.count > 8 ? (Int(a[8]) ?? 200) : 200

let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
let track = asset.tracks(withMediaType: .video).first
let nat = track?.naturalSize ?? CGSize(width: 1180, height: 2556)
let aspect = nat.height / nat.width
let thumbH = Int(Double(thumbW) * aspect)

try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let interval = 1.0 / fps
var times: [NSValue] = []
var t = startSec
let end = min(startSec + maxSec, totalDur)
while t < end { times.append(NSValue(time: CMTime(seconds: t, preferredTimescale: 600))); t += interval }

let sem = DispatchSemaphore(value: 0)
let lock = NSLock()
var got: [(Double, CGImage)] = []
var remaining = times.count
gen.generateCGImagesAsynchronously(forTimes: times) { _, cg, actual, result, _ in
    lock.lock()
    if let cg = cg, result == .succeeded { got.append((CMTimeGetSeconds(actual), cg)) }
    remaining -= 1
    let done = remaining == 0
    lock.unlock()
    if done { sem.signal() }
}
sem.wait()
got.sort { $0.0 < $1.0 }

let perSheet = cols * rows
let pad = 6
let labelH = 18
let cellW = thumbW + pad
let cellH = thumbH + labelH + pad
let sheetW = cols * cellW + pad
let sheetH = rows * cellH + pad

func makeSheet(_ slice: ArraySlice<(Double, CGImage)>, index: Int) {
    let img = NSImage(size: NSSize(width: sheetW, height: sheetH))
    img.lockFocus()
    NSColor(white: 0.08, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: sheetW, height: sheetH).fill()
    let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .semibold),
        .foregroundColor: NSColor.green
    ]
    for (i, pair) in slice.enumerated() {
        let col = i % cols
        let row = i / cols
        // AppKit origin is bottom-left; lay rows top-down.
        let x = pad + col * cellW
        let y = sheetH - pad - (row + 1) * cellH + labelH
        let rep = NSBitmapImageRep(cgImage: pair.1)
        let thumb = NSImage(size: NSSize(width: thumbW, height: thumbH))
        thumb.addRepresentation(rep)
        thumb.draw(in: NSRect(x: x, y: y, width: thumbW, height: thumbH))
        let label = String(format: "t=%.1fs", pair.0)
        label.draw(at: NSPoint(x: x + 2, y: y - labelH), withAttributes: attrs)
    }
    img.unlockFocus()
    guard let tiff = img.tiffRepresentation,
          let bmp = NSBitmapImageRep(data: tiff),
          let png = bmp.representation(using: .png, properties: [:]) else { return }
    let url = URL(fileURLWithPath: outDir).appendingPathComponent(String(format: "sheet-%03d.png", index))
    try? png.write(to: url)
}

var sheetIdx = 0
var i = 0
while i < got.count {
    let slice = got[i ..< min(i + perSheet, got.count)]
    makeSheet(slice, index: sheetIdx)
    sheetIdx += 1
    i += perSheet
}
print("\((videoPath as NSString).lastPathComponent): \(got.count) frames → \(sheetIdx) sheets @ \(String(format: "%.1f", fps))fps, grid \(cols)x\(rows), window \(String(format: "%.0f", startSec))-\(String(format: "%.0f", end))s")
