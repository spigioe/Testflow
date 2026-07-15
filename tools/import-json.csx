#!/usr/bin/env dotnet-script
// ============================================================
//  TestFlow – JSON → SQLite importáló szkript
//
//  Telepítés (egyszer):
//    dotnet tool install -g dotnet-script
//
//  Futtatás:
//    dotnet script import-json.csx -- <json_fájl> <sqlite_fájl>
//
//  Példa:
//    dotnet script import-json.csx -- testflow_data.json testflow.db
// ============================================================

#r "nuget: Microsoft.Data.Sqlite, 8.0.0"
#r "nuget: System.Text.Json, 8.0.0"

using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

// ── Argumentumok ────────────────────────────────────────────
if (Args.Count < 2)
{
    Console.WriteLine("Használat: dotnet script import-json.csx -- <json_fájl> <sqlite_fájl>");
    Console.WriteLine("Példa:     dotnet script import-json.csx -- data.json testflow.db");
    return 1;
}

var jsonPath   = Args[0];
var sqlitePath = Args[1];

if (!File.Exists(jsonPath))
{
    Console.Error.WriteLine($"[HIBA] A JSON fájl nem található: {jsonPath}");
    return 1;
}

Console.WriteLine($"[→] JSON fájl: {jsonPath}");
Console.WriteLine($"[→] SQLite DB: {sqlitePath}");

// ── JSON beolvasás ────────────────────────────────────────────
var jsonText = await File.ReadAllTextAsync(jsonPath);
var root     = JsonNode.Parse(jsonText)!;

// Támogatja mind a régi (tömb) és az új ({ suites: [...] }) formátumot
JsonArray suitesArray;
if (root is JsonArray arr)
{
    suitesArray = arr;
    Console.WriteLine("[!] Régi formátum (tömb) detektálva – automatikus konverzió...");
}
else
{
    suitesArray = root["suites"]?.AsArray() ?? new JsonArray();
}

Console.WriteLine($"[✓] {suitesArray.Count} halmaz beolvasva");

// ── SQLite kapcsolat + séma ────────────────────────────────────
var conn = new SqliteConnection($"Data Source={sqlitePath}");
conn.Open();

void Exec(string sql, object? parms = null)
{
    using var cmd = conn.CreateCommand();
    cmd.CommandText = sql;
    if (parms != null)
    {
        foreach (var prop in parms.GetType().GetProperties())
            cmd.Parameters.AddWithValue($"@{prop.Name}", prop.GetValue(parms) ?? DBNull.Value);
    }
    cmd.ExecuteNonQuery();
}

// Séma (idempotens)
Exec("PRAGMA foreign_keys = ON");
Exec("PRAGMA journal_mode = WAL");
Exec("""
    CREATE TABLE IF NOT EXISTS Suites (
        Id TEXT PRIMARY KEY, Name TEXT NOT NULL, Notes TEXT NOT NULL DEFAULT '',
        Status TEXT NOT NULL DEFAULT '', ClickupId TEXT NOT NULL DEFAULT '',
        IsCompleted INTEGER NOT NULL DEFAULT 0, TestSession TEXT DEFAULT NULL,
        SortOrder INTEGER NOT NULL DEFAULT 0,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        UpdatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """);
Exec("""
    CREATE TABLE IF NOT EXISTS TestCases (
        Id TEXT PRIMARY KEY, SuiteId TEXT NOT NULL, Name TEXT NOT NULL,
        Steps TEXT NOT NULL DEFAULT '', ExpectedResult TEXT NOT NULL DEFAULT '',
        ActualResult TEXT NOT NULL DEFAULT '', Evaluation TEXT NOT NULL DEFAULT '',
        SortOrder INTEGER NOT NULL DEFAULT 0,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        UpdatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """);
Exec("""
    CREATE TABLE IF NOT EXISTS Attachments (
        Id INTEGER PRIMARY KEY AUTOINCREMENT, TestCaseId TEXT NOT NULL,
        DataUrl TEXT NOT NULL, FileName TEXT NOT NULL DEFAULT '',
        SizePx TEXT NOT NULL DEFAULT '', SizeKb INTEGER NOT NULL DEFAULT 0,
        SortOrder INTEGER NOT NULL DEFAULT 0,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """);
Exec("CREATE INDEX IF NOT EXISTS idx_tc_suite ON TestCases(SuiteId)");
Exec("CREATE INDEX IF NOT EXISTS idx_att_tc   ON Attachments(TestCaseId)");

// ── Import ───────────────────────────────────────────────────
using var tx = conn.BeginTransaction();
int suiteCount = 0, tcCount = 0, attCount = 0;

string S(JsonNode? n) => n?.GetValue<string>() ?? "";
bool   B(JsonNode? n) => n?.GetValue<bool>() ?? false;
int    I(JsonNode? n, int def = 0)
{
    try { return n?.GetValue<int>() ?? def; }
    catch { return def; }
}

for (int si = 0; si < suitesArray.Count; si++)
{
    var s     = suitesArray[si]!;
    var suiteId = S(s["id"]);
    if (string.IsNullOrWhiteSpace(suiteId)) suiteId = Guid.NewGuid().ToString();

    using (var cmd = conn.CreateCommand())
    {
        cmd.Transaction = tx;
        cmd.CommandText = """
            INSERT OR REPLACE INTO Suites
                (Id, Name, Notes, Status, ClickupId, IsCompleted, TestSession, SortOrder)
            VALUES
                (@Id, @Name, @Notes, @Status, @ClickupId, @IsCompleted, @TestSession, @SortOrder)
            """;
        cmd.Parameters.AddWithValue("@Id",          suiteId);
        cmd.Parameters.AddWithValue("@Name",        S(s["name"]));
        cmd.Parameters.AddWithValue("@Notes",       S(s["notes"]));
        cmd.Parameters.AddWithValue("@Status",      S(s["status"]));
        cmd.Parameters.AddWithValue("@ClickupId",   S(s["clickupId"]));
        cmd.Parameters.AddWithValue("@IsCompleted", B(s["isCompleted"]) ? 1 : 0);
        cmd.Parameters.AddWithValue("@TestSession", (object?)(s["testSession"]?.ToJsonString()) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@SortOrder",   si);
        cmd.ExecuteNonQuery();
    }
    suiteCount++;

    var tcs = s["testCases"]?.AsArray() ?? new JsonArray();
    for (int ti = 0; ti < tcs.Count; ti++)
    {
        var tc   = tcs[ti]!;
        var tcId = S(tc["id"]);
        if (string.IsNullOrWhiteSpace(tcId)) tcId = $"TC_{Guid.NewGuid():N}"[..12];

        using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT OR REPLACE INTO TestCases
                    (Id, SuiteId, Name, Steps, ExpectedResult, ActualResult, Evaluation, SortOrder)
                VALUES
                    (@Id, @SuiteId, @Name, @Steps, @ExpectedResult, @ActualResult, @Evaluation, @SortOrder)
                """;
            cmd.Parameters.AddWithValue("@Id",             tcId);
            cmd.Parameters.AddWithValue("@SuiteId",        suiteId);
            cmd.Parameters.AddWithValue("@Name",           S(tc["name"]));
            cmd.Parameters.AddWithValue("@Steps",          S(tc["steps"]));
            cmd.Parameters.AddWithValue("@ExpectedResult", S(tc["expectedResult"]));
            cmd.Parameters.AddWithValue("@ActualResult",   S(tc["actualResult"]));
            cmd.Parameters.AddWithValue("@Evaluation",     S(tc["evaluation"]));
            cmd.Parameters.AddWithValue("@SortOrder",      ti);
            cmd.ExecuteNonQuery();
        }
        tcCount++;

        // Csatolmányok törlése majd újrafelvétel
        using (var del = conn.CreateCommand())
        {
            del.Transaction  = tx;
            del.CommandText  = "DELETE FROM Attachments WHERE TestCaseId = @TcId";
            del.Parameters.AddWithValue("@TcId", tcId);
            del.ExecuteNonQuery();
        }

        var atts = tc["attachments"]?.AsArray() ?? new JsonArray();
        for (int ai = 0; ai < atts.Count; ai++)
        {
            var att = atts[ai]!;
            using var cmd = conn.CreateCommand();
            cmd.Transaction  = tx;
            cmd.CommandText  = """
                INSERT INTO Attachments (TestCaseId, DataUrl, FileName, SizePx, SizeKb, SortOrder)
                VALUES (@TestCaseId, @DataUrl, @FileName, @SizePx, @SizeKb, @SortOrder)
                """;
            cmd.Parameters.AddWithValue("@TestCaseId", tcId);
            cmd.Parameters.AddWithValue("@DataUrl",    S(att["dataUrl"]));
            cmd.Parameters.AddWithValue("@FileName",   S(att["name"]) is var fn && fn != "" ? fn : S(att["fileName"]));
            cmd.Parameters.AddWithValue("@SizePx",     S(att["sizePx"]));
            cmd.Parameters.AddWithValue("@SizeKb",     I(att["sizeKb"]));
            cmd.Parameters.AddWithValue("@SortOrder",  ai);
            cmd.ExecuteNonQuery();
            attCount++;
        }
    }

    if ((si + 1) % 10 == 0)
        Console.WriteLine($"  [{si + 1}/{suitesArray.Count}] feldolgozva...");
}

tx.Commit();
conn.Close();

Console.WriteLine();
Console.WriteLine("╔══════════════════════════════════════╗");
Console.WriteLine("║         Import kész!                 ║");
Console.WriteLine($"║  Halmazok:    {suiteCount,-5}                   ║");
Console.WriteLine($"║  Tesztesetek: {tcCount,-5}                   ║");
Console.WriteLine($"║  Csatolmány:  {attCount,-5}                   ║");
Console.WriteLine("╚══════════════════════════════════════╝");
Console.WriteLine($"SQLite fájl: {sqlitePath}");

return 0;
