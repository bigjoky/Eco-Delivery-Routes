import Foundation

public struct ShipmentsImportResult: Codable {
    public struct Row: Codable, Identifiable {
        public let id: String
        public let row: Int
        public let reference: String?
        public let status: String
        public let errors: [String]?

        public init(id: String, row: Int, reference: String?, status: String, errors: [String]?) {
            self.id = id
            self.row = row
            self.reference = reference
            self.status = status
            self.errors = errors
        }
    }

    public let dryRun: Bool
    public let createdCount: Int
    public let skippedCount: Int
    public let errorCount: Int
    public let rows: [Row]
    public let warnings: [String]
    public let unknownColumns: [String]

    public init(
        dryRun: Bool,
        createdCount: Int,
        skippedCount: Int,
        errorCount: Int,
        rows: [Row],
        warnings: [String],
        unknownColumns: [String]
    ) {
        self.dryRun = dryRun
        self.createdCount = createdCount
        self.skippedCount = skippedCount
        self.errorCount = errorCount
        self.rows = rows
        self.warnings = warnings
        self.unknownColumns = unknownColumns
    }

    enum CodingKeys: String, CodingKey {
        case dryRun = "dry_run"
        case createdCount = "created_count"
        case skippedCount = "skipped_count"
        case errorCount = "error_count"
        case rows
        case warnings
        case unknownColumns = "unknown_columns"
    }
}
