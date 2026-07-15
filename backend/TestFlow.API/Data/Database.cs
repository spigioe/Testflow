using Microsoft.Data.Sqlite;
using Dapper;

namespace TestFlow.API.Data;

public class Database
{
    private readonly string _connectionString;

    public Database(IConfiguration config)
    {
        var dbPath = config["Database:Path"] ?? "testflow.db";
        _connectionString = $"Data Source={dbPath}";
        EnsureCreated(dbPath);
    }

    public SqliteConnection Open()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        conn.Execute("PRAGMA foreign_keys = ON;");
        conn.Execute("PRAGMA journal_mode = WAL;");
        return conn;
    }

    private void EnsureCreated(string dbPath)
    {
        // Séma betöltése – lehetőleg a schema.sql-ből, fallback: inline
        var schemaFile = Path.Combine(AppContext.BaseDirectory, "schema.sql");
        string schema;

        if (File.Exists(schemaFile))
        {
            schema = File.ReadAllText(schemaFile);
        }
        else
        {
            schema = EmbeddedSchema;
        }

        using var conn = new SqliteConnection(_connectionString);
        conn.Open();
        conn.Execute("PRAGMA foreign_keys = ON;");
        conn.Execute("PRAGMA journal_mode = WAL;");

        // Több statement-et kézzel futtatunk (SQLite nem támogatja a batch-et)
        foreach (var stmt in schema.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var trimmed = stmt.Trim();
            if (!string.IsNullOrWhiteSpace(trimmed))
            {
                try { conn.Execute(trimmed); }
                catch { /* már létező objektumok – ignorálható */ }
            }
        }
    }

    // Inline fallback séma (megegyezik a schema.sql tartalmával)
    private const string EmbeddedSchema = """
        CREATE TABLE IF NOT EXISTS Suites (
            Id            TEXT    PRIMARY KEY,
            Name          TEXT    NOT NULL,
            Notes         TEXT    NOT NULL DEFAULT '',
            Status        TEXT    NOT NULL DEFAULT '',
            ClickupId     TEXT    NOT NULL DEFAULT '',
            IsCompleted   INTEGER NOT NULL DEFAULT 0,
            TestSession   TEXT             DEFAULT NULL,
            SortOrder     INTEGER NOT NULL DEFAULT 0,
            CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
            UpdatedAt     TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS TestCases (
            Id             TEXT    PRIMARY KEY,
            SuiteId        TEXT    NOT NULL REFERENCES Suites(Id) ON DELETE CASCADE,
            Name           TEXT    NOT NULL,
            Steps          TEXT    NOT NULL DEFAULT '',
            ExpectedResult TEXT    NOT NULL DEFAULT '',
            ActualResult   TEXT    NOT NULL DEFAULT '',
            Evaluation     TEXT    NOT NULL DEFAULT '',
            SortOrder      INTEGER NOT NULL DEFAULT 0,
            CreatedAt      TEXT    NOT NULL DEFAULT (datetime('now')),
            UpdatedAt      TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS Attachments (
            Id          INTEGER PRIMARY KEY AUTOINCREMENT,
            TestCaseId  TEXT    NOT NULL REFERENCES TestCases(Id) ON DELETE CASCADE,
            DataUrl     TEXT    NOT NULL,
            FileName    TEXT    NOT NULL DEFAULT '',
            SizePx      TEXT    NOT NULL DEFAULT '',
            SizeKb      INTEGER NOT NULL DEFAULT 0,
            SortOrder   INTEGER NOT NULL DEFAULT 0,
            CreatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_testcases_suiteid ON TestCases(SuiteId);
        CREATE INDEX IF NOT EXISTS idx_attachments_testcaseid ON Attachments(TestCaseId)
        """;
}
