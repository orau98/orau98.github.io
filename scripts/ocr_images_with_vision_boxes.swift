#!/usr/bin/env swift

import AppKit
import Foundation
import Vision

struct OCRLine: Encodable {
    let text: String
    let confidence: Float
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct OCRResult: Encodable {
    let path: String
    let imageWidth: Int
    let imageHeight: Int
    let lines: [OCRLine]
}

enum OCRFailure: Error {
    case unreadableImage(String)
    case cgImageUnavailable(String)
}

func loadCGImage(at path: String) throws -> CGImage {
    let url = URL(fileURLWithPath: path)
    guard let image = NSImage(contentsOf: url) else {
        throw OCRFailure.unreadableImage(path)
    }
    var rect = NSRect(origin: .zero, size: image.size)
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw OCRFailure.cgImageUnavailable(path)
    }
    return cgImage
}

func recognizeText(in path: String) throws -> OCRResult {
    let cgImage = try loadCGImage(at: path)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    if #available(macOS 13.0, *) {
        request.recognitionLanguages = ["ja-JP", "en-US"]
        request.automaticallyDetectsLanguage = false
    }

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let lines = (request.results ?? [])
        .compactMap { observation -> OCRLine? in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }
            let box = observation.boundingBox
            return OCRLine(
                text: candidate.string,
                confidence: candidate.confidence,
                x: Double(box.origin.x),
                y: Double(box.origin.y),
                width: Double(box.size.width),
                height: Double(box.size.height)
            )
        }
        .sorted {
            if abs($0.y - $1.y) > 0.01 {
                return $0.y > $1.y
            }
            return $0.x < $1.x
        }

    return OCRResult(
        path: path,
        imageWidth: cgImage.width,
        imageHeight: cgImage.height,
        lines: lines
    )
}

let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty else {
    FileHandle.standardError.write(Data("usage: scripts/ocr_images_with_vision_boxes.swift <image>...\n".utf8))
    exit(1)
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]

for path in args {
    do {
        let result = try recognizeText(in: path)
        let data = try encoder.encode(result)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data([0x0a]))
    } catch {
        let message = "OCR failed for \(path): \(error)\n"
        FileHandle.standardError.write(Data(message.utf8))
        exit(1)
    }
}
