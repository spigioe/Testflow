using Dapper;
using TestFlow.API.Models;

namespace TestFlow.API.Data;

public class SuiteRepository(Database db)
{
    // ── Összes suite ───────────────────────────────────────────
    public async Task<List<Suite>> GetAllAsync()
    {
        using var conn = db.Open();
        var suites = (await conn.QueryAsync<Suite>(
            "SELECT * FROM Suites ORDER BY SortOrder, CreatedAt")).ToList();

        if (!suites.Any()) return suites;

        var testCases = (await conn.QueryAsync<TestCase>(
            "SELECT * FROM TestCases ORDER BY SortOrder")).ToList();

        var attachments = (await conn.QueryAsync<Attachment>(
            "SELECT * FROM Attachments ORDER BY SortOrder")).ToList();

        // Assembling
        var attByTc   = attachments.GroupBy(a => a.TestCaseId)
                                   .ToDictionary(g => g.Key, g => g.ToList());
        var tcBySuite = testCases.GroupBy(t => t.SuiteId)
                                 .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var tc in testCases)
            tc.Attachments = attByTc.TryGetValue(tc.Id, out var a) ? a : [];

        foreach (var s in suites)
            s.TestCases = tcBySuite.TryGetValue(s.Id, out var t) ? t : [];

        return suites;
    }

    // ── Egy suite ──────────────────────────────────────────────
    public async Task<Suite?> GetByIdAsync(string id)
    {
        using var conn = db.Open();
        var suite = await conn.QueryFirstOrDefaultAsync<Suite>(
            "SELECT * FROM Suites WHERE Id = @Id", new { Id = id });

        if (suite is null) return null;

        var testCases = (await conn.QueryAsync<TestCase>(
            "SELECT * FROM TestCases WHERE SuiteId = @SuiteId ORDER BY SortOrder",
            new { SuiteId = id })).ToList();

        var tcIds = testCases.Select(t => t.Id).ToList();
        List<Attachment> attachments = [];

        if (tcIds.Any())
        {
            var inClause = string.Join(",", tcIds.Select((_, i) => $"@p{i}"));
            var parms = new DynamicParameters();
            for (int i = 0; i < tcIds.Count; i++) parms.Add($"p{i}", tcIds[i]);

            attachments = (await conn.QueryAsync<Attachment>(
                $"SELECT * FROM Attachments WHERE TestCaseId IN ({inClause}) ORDER BY SortOrder",
                parms)).ToList();
        }

        var attByTc = attachments.GroupBy(a => a.TestCaseId)
                                 .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var tc in testCases)
            tc.Attachments = attByTc.TryGetValue(tc.Id, out var a) ? a : [];

        suite.TestCases = testCases;
        return suite;
    }

    // ── Upsert suite (teljes suite cseréje) ────────────────────
    public async Task UpsertAsync(UpsertSuiteRequest req)
    {
        using var conn = db.Open();
        using var tx   = conn.BeginTransaction();

        // Suite
        await conn.ExecuteAsync("""
            INSERT INTO Suites (Id, Name, Notes, Status, ClickupId, IsCompleted, TestSession, SortOrder)
            VALUES (@Id, @Name, @Notes, @Status, @ClickupId, @IsCompleted, @TestSession, @SortOrder)
            ON CONFLICT(Id) DO UPDATE SET
                Name        = excluded.Name,
                Notes       = excluded.Notes,
                Status      = excluded.Status,
                ClickupId   = excluded.ClickupId,
                IsCompleted = excluded.IsCompleted,
                TestSession = excluded.TestSession,
                SortOrder   = excluded.SortOrder,
                UpdatedAt   = datetime('now')
            """, new {
                req.Id, req.Name, req.Notes, req.Status, req.ClickupId,
                IsCompleted = req.IsCompleted ? 1 : 0,
                req.TestSession, req.SortOrder
            }, tx);

        // Meglévő tesztesetek ID-jait összegyűjtjük
        var existingIds = (await conn.QueryAsync<string>(
            "SELECT Id FROM TestCases WHERE SuiteId = @SuiteId",
            new { SuiteId = req.Id }, tx)).ToHashSet();

        var incomingIds = req.TestCases.Select(t => t.Id).ToHashSet();

        // Töröljük azokat amik kikerültek
        foreach (var oldId in existingIds.Except(incomingIds))
            await conn.ExecuteAsync("DELETE FROM TestCases WHERE Id = @Id", new { Id = oldId }, tx);

        // TestCase-ek upsert
        for (int i = 0; i < req.TestCases.Count; i++)
        {
            var tc = req.TestCases[i];
            await conn.ExecuteAsync("""
                INSERT INTO TestCases (Id, SuiteId, Name, Steps, ExpectedResult, ActualResult, Evaluation, SortOrder)
                VALUES (@Id, @SuiteId, @Name, @Steps, @ExpectedResult, @ActualResult, @Evaluation, @SortOrder)
                ON CONFLICT(Id) DO UPDATE SET
                    Name           = excluded.Name,
                    Steps          = excluded.Steps,
                    ExpectedResult = excluded.ExpectedResult,
                    ActualResult   = excluded.ActualResult,
                    Evaluation     = excluded.Evaluation,
                    SortOrder      = excluded.SortOrder,
                    UpdatedAt      = datetime('now')
                """, new {
                    tc.Id, SuiteId = req.Id, tc.Name, tc.Steps,
                    tc.ExpectedResult, tc.ActualResult, tc.Evaluation,
                    SortOrder = i
                }, tx);

            // Csatolmányok: töröljük a régit, felírjuk az újat
            await conn.ExecuteAsync(
                "DELETE FROM Attachments WHERE TestCaseId = @TcId",
                new { TcId = tc.Id }, tx);

            for (int j = 0; j < tc.Attachments.Count; j++)
            {
                var att = tc.Attachments[j];
                await conn.ExecuteAsync("""
                    INSERT INTO Attachments (TestCaseId, DataUrl, FileName, SizePx, SizeKb, SortOrder)
                    VALUES (@TestCaseId, @DataUrl, @FileName, @SizePx, @SizeKb, @SortOrder)
                    """, new {
                        TestCaseId = tc.Id, att.DataUrl, att.FileName,
                        att.SizePx, att.SizeKb, SortOrder = j
                    }, tx);
            }
        }

        tx.Commit();
    }

    // ── Törlés ─────────────────────────────────────────────────
    public async Task DeleteAsync(string id)
    {
        using var conn = db.Open();
        await conn.ExecuteAsync("DELETE FROM Suites WHERE Id = @Id", new { Id = id });
    }

    // ── Átrendezés ─────────────────────────────────────────────
    public async Task ReorderAsync(List<string> orderedIds)
    {
        using var conn = db.Open();
        using var tx   = conn.BeginTransaction();
        for (int i = 0; i < orderedIds.Count; i++)
            await conn.ExecuteAsync(
                "UPDATE Suites SET SortOrder = @Order WHERE Id = @Id",
                new { Order = i, Id = orderedIds[i] }, tx);
        tx.Commit();
    }
}
