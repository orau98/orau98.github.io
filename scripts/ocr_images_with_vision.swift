#!/usr/bin/env swift

import AppKit
import Foundation
import Vision

struct OCRResult: Encodable {
    let path: String
    let text: String
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

    let text = (request.results ?? [])
        .compactMap { $0.topCandidates(1).first?.string }
        .joined(separator: "\n")

    return OCRResult(path: path, text: text)
}

let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty else {
    FileHandle.standardError.write(Data("usage: scripts/ocr_images_with_vision.swift <image>...\n".utf8))
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
