#!/usr/bin/env dotnet-script
// ============================================================
//  TestFlow – JSON → PostgreSQL importáló szkript
//
//  Telepítés:
//    dotnet tool install -g dotnet-script
//
//  Futtatás:
//    dotnet script import-json.csx -- <json_fájl> "<connection_string>"
//
//  Példa:
//    dotnet script import-json.csx -- data.json \
//      "Host=dpg-xxx.oregon-postgres.render.com;Database=testflow;Username=testflow;Password=xxx;SSL Mode=Require;Trust Server Certificate=true;"
//
//  A connection string a Render dashboardon:
//    testflow-db → Info → External Connection String
// ============================================================

#r "nuget: Npgsql, 8.0.3"
#r "nuget: System.Text.Json, 8.0.0"

using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;

if (Args.Count < 2)
{
    Console.WriteLine("Használat: dotnet script import-json.csx -- <json> \"<connection_string>\"");
    return 1;
}

var jsonPath  = Args[0];
var connStr   = Args[1];

if (!File.Exists(jsonPath))
{
    Console.Error.WriteLine($"[HIBA] JSON fájl nem található: {jsonPath}");
    return 1;
}

// postgres:// URL → Npgsql konverzió
if (connStr.StartsWith("postgres://") || connStr.StartsWith("postgresql://"))
{
    var uri  = new Uri(connStr);
    var user = uri.UserInfo.Split(':');
    var db   = uri.AbsolutePath.TrimStart('/');
    connStr  = $"Host={uri.Host};Port={uri.Port};Database={db};" +
               $"Username={user[0]};Password={user[1]};" +
               $"SSL Mode=Require;Trust Server Certificate=true;";
}

Console.WriteLine($"[→] JSON: {jsonPath}");
Console.WriteLine($"[→] DB:   {connStr[..Math.Min(60, connStr.Length)]}...");

var jsonText = await File.ReadAllTextAsync(jsonPath);
var root     = JsonNode.Parse(jsonText)!;

JsonArray suitesArr = root is JsonArray a ? a
    : root["suites"]?.AsArray() ?? new JsonArray();

Console.WriteLine($"[✓] {suitesArr.Count} halmaz beolvasva");

await using var conn = new NpgsqlConnection(connStr);
await conn.OpenAsync();

string S(JsonNode? n) => n?.GetValue<string>() ?? "";
bool   B(JsonNode? n) => n?.GetValue<bool>() ?? false;
int    I(JsonNode? n) { try { return n?.GetValue<int>() ?? 0; } catch { return 0; } }

await using var tx = await conn.BeginTransactionAsync();
int suites = 0, tcs = 0, atts = 0;

for (int si = 0; si < suitesArr.Count; si++)
{
    var s       = suitesArr[si]!;
    var suiteId = S(s["id"]);
    if (string.IsNullOrWhiteSpace(suiteId)) suiteId = Guid.NewGuid().ToString();

    await using (var cmd = conn.CreateCommand())
    {
        cmd.Transaction  = tx;
        cmd.CommandText  = """
            INSERT INTO suites (id, name, notes, status, clickup_id, is_completed, test_session, sort_order)
            VALUES (@id, @name, @notes, @status, @clickup_id, @is_completed, @test_session, @sort_order)
            ON CONFLICT (id) DO UPDATE SET
                name         = EXCLUDED.name,
                notes        = EXCLUDED.notes,
                status       = EXCLUDED.status,
                clickup_id   = EXCLUDED.clickup_id,
                is_completed = EXCLUDED.is_completed,
                test_session = EXCLUDED.test_session,
                sort_order   = EXCLUDED.sort_order
            """;
        cmd.Parameters.AddWithValue("id",           suiteId);
        cmd.Parameters.AddWithValue("name",         S(s["name"]));
        cmd.Parameters.AddWithValue("notes",        S(s["notes"]));
        cmd.Parameters.AddWithValue("status",       S(s["status"]));
        cmd.Parameters.AddWithValue("clickup_id",   S(s["clickupId"]));
        cmd.Parameters.AddWithValue("is_completed", B(s["isCompleted"]));
        cmd.Parameters.AddWithValue("test_session", (object?)(s["testSession"]?.ToJsonString()) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("sort_order",   si);
        await cmd.ExecuteNonQueryAsync();
    }
    suites++;

    var tcsArr = s["testCases"]?.AsArray() ?? new JsonArray();
    for (int ti = 0; ti < tcsArr.Count; ti++)
    {
        var tc   = tcsArr[ti]!;
        var tcId = S(tc["id"]);
        if (string.IsNullOrWhiteSpace(tcId)) tcId = Guid.NewGuid().ToString();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO test_cases
                    (id, suite_id, name, steps, expected_result, actual_result, evaluation, sort_order)
                VALUES
                    (@id, @suite_id, @name, @steps, @expected_result, @actual_result, @evaluation, @sort_order)
                ON CONFLICT (id) DO UPDATE SET
                    name            = EXCLUDED.name,
                    steps           = EXCLUDED.steps,
                    expected_result = EXCLUDED.expected_result,
                    actual_result   = EXCLUDED.actual_result,
                    evaluation      = EXCLUDED.evaluation,
                    sort_order      = EXCLUDED.sort_order
                """;
            cmd.Parameters.AddWithValue("id",              tcId);
            cmd.Parameters.AddWithValue("suite_id",        suiteId);
            cmd.Parameters.AddWithValue("name",            S(tc["name"]));
            cmd.Parameters.AddWithValue("steps",           S(tc["steps"]));
            cmd.Parameters.AddWithValue("expected_result", S(tc["expectedResult"]));
            cmd.Parameters.AddWithValue("actual_result",   S(tc["actualResult"]));
            cmd.Parameters.AddWithValue("evaluation",      S(tc["evaluation"]));
            cmd.Parameters.AddWithValue("sort_order",      ti);
            await cmd.ExecuteNonQueryAsync();
        }
        tcs++;

        // Csatolmányok
        await using (var del = conn.CreateCommand())
        {
            del.Transaction = tx;
            del.CommandText = "DELETE FROM attachments WHERE test_case_id = @id";
            del.Parameters.AddWithValue("id", tcId);
            await del.ExecuteNonQueryAsync();
        }

        var attsArr = tc["attachments"]?.AsArray() ?? new JsonArray();
        for (int ai = 0; ai < attsArr.Count; ai++)
        {
            var att = attsArr[ai]!;
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = """
                INSERT INTO attachments (test_case_id, data_url, file_name, size_px, size_kb, sort_order)
                VALUES (@tc_id, @data_url, @file_name, @size_px, @size_kb, @sort_order)
                """;
            cmd.Parameters.AddWithValue("tc_id",      tcId);
            cmd.Parameters.AddWithValue("data_url",   S(att["dataUrl"]));
            cmd.Parameters.AddWithValue("file_name",  S(att["name"]) is var fn && fn != "" ? fn : S(att["fileName"]));
            cmd.Parameters.AddWithValue("size_px",    S(att["sizePx"]));
            cmd.Parameters.AddWithValue("size_kb",    I(att["sizeKb"]));
            cmd.Parameters.AddWithValue("sort_order", ai);
            await cmd.ExecuteNonQueryAsync();
            atts++;
        }
    }

    if ((si + 1) % 5 == 0 || si == suitesArr.Count - 1)
        Console.WriteLine($"  [{si + 1}/{suitesArr.Count}] feldolgozva...");
}

await tx.CommitAsync();

Console.WriteLine();
Console.WriteLine("╔══════════════════════════════════╗");
Console.WriteLine("║       Import kész!               ║");
Console.WriteLine($"║  Halmazok:    {suites,-5}             ║");
Console.WriteLine($"║  Tesztesetek: {tcs,-5}             ║");
Console.WriteLine($"║  Csatolmány:  {atts,-5}             ║");
Console.WriteLine("╚══════════════════════════════════╝");
return 0;
