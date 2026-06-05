import Foundation

// fzf-v1-style fuzzy subsequence scorer — a Swift port of src/core/fuzzy.ts.
// Same weights, same behavior, so the GUI ranks New dirs + Resume sessions exactly
// like the terminal does. No substring pre-filter: gapped matches are the point.

struct FuzzyResult {
    let score: Double
    let positions: [Int]
}

enum Fuzzy {
    private static let bonusConsecutive = 8.0   // contiguous runs beat scattered boundary hits
    private static let bonusBoundary = 6.0       // match at a word boundary (start / after separator / camelCase)
    private static let separators: Set<Character> = ["/", "\\", "_", "-", ".", " "]

    /// Score `text` against `query` (case-insensitive subsequence). Higher = better.
    /// Returns nil if `query` is not a subsequence. Empty query → score 0.
    static func match(_ query: String, _ text: String) -> FuzzyResult? {
        if query.isEmpty { return FuzzyResult(score: 0, positions: []) }
        let q = Array(query.lowercased())
        let original = Array(text)
        let t = Array(text.lowercased())
        var positions: [Int] = []
        var qi = 0
        var score = 0.0
        var prevMatch = -2
        var ti = 0
        while ti < t.count && qi < q.count {
            if t[ti] != q[qi] { ti += 1; continue }
            var bonus = 1.0
            if prevMatch == ti - 1 { bonus += bonusConsecutive }
            let prev: Character? = ti > 0 ? original[ti - 1] : nil
            if ti == 0 || (prev != nil && separators.contains(prev!)) {
                bonus += bonusBoundary
            } else if let p = prev,
                      String(p) == String(p).lowercased(),       // prev unchanged by lowercasing (matches TS)
                      String(original[ti]) != String(original[ti]).lowercased() { // cur is uppercase
                bonus += bonusBoundary - 2 // camelCase boundary (lower/digit/sym → Upper)
            }
            score += bonus
            positions.append(ti)
            prevMatch = ti
            qi += 1
            ti += 1
        }
        if qi < q.count { return nil } // not all query chars consumed
        let span = positions[positions.count - 1] - positions[0]
        score -= Double(positions[0]) * 0.5 + Double(span) * 0.2
        return FuzzyResult(score: score, positions: positions)
    }

    /// Rank items by score against `getText`, dropping non-matches. Empty query keeps original order (stable).
    static func rank<T>(_ query: String, _ items: [T], _ getText: (T) -> String) -> [T] {
        if query.isEmpty { return items }
        let scored: [(item: T, score: Double, i: Int)] = items.enumerated().compactMap { i, item in
            guard let r = match(query, getText(item)) else { return nil }
            return (item, r.score, i)
        }
        return scored
            .sorted { $0.score != $1.score ? $0.score > $1.score : $0.i < $1.i }
            .map { $0.item }
    }
}
