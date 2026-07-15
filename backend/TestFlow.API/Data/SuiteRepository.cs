using Dapper;
using TestFlow.API.Models;

namespace TestFlow.API.Data;

public class SuiteRepository(Database db)
{
    // ── Összes suite ───────────────────────────────────────────
    public async Task<List<Suite>> GetAllAsync()
    {
        await using var conn = await db.OpenAsync();

        var suites = (await conn.QueryAsync<Suite>(
            "SELECT * FROM suites ORDER BY sort_order, created_at")).ToList();

        if (!suites.Any()) return suites;

        var testCases = (await conn.QueryAsync<TestCase>(
            "SELECT * FROM test_cases ORDER BY suite_id, sort_order")).ToList();

        var attachments = (await conn.QueryAsync<Attachment>(
            "SELECT * FROM attachments ORDER BY test_case_id, sort_order")).ToList();

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
        await using var conn = await db.OpenAsync();

        var suite = await conn.QueryFirstOrDefaultAsync<Suite>(
            "SELECT * FROM suites WHERE id = @Id", new { Id = id });

        if (suite is null) return null;

        var testCases = (await conn.QueryAsync<TestCase>(
            "SELECT * FROM test_cases WHERE suite_id = @SuiteId ORDER BY sort_order",
            new { SuiteId = id })).ToList();

        List<Attachment> attachments = [];
        if (testCases.Any())
        {
            var tcIds = testCases.Select(t => t.Id).ToArray();
            attachments = (await conn.QueryAsync<Attachment>(
                "SELECT * FROM attachments WHERE test_case_id = ANY(@Ids) ORDER BY sort_order",
                new { Ids = tcIds })).ToList();
        }

        var attByTc = attachments.GroupBy(a => a.TestCaseId)
                                 .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var tc in testCases)
            tc.Attachments = attByTc.TryGetValue(tc.Id, out var a) ? a : [];

        suite.TestCases = testCases;
        return suite;
    }

    // ── Upsert ─────────────────────────────────────────────────
    public async Task UpsertAsync(UpsertSuiteRequest req)
    {
        await using var conn = await db.OpenAsync();
        await using var tx   = await conn.BeginTransactionAsync();

        // Suite upsert
        await conn.ExecuteAsync("""
            INSERT INTO suites (id, name, notes, status, clickup_id, is_completed, test_session, sort_order)
            VALUES (@Id, @Name, @Notes, @Status, @ClickupId, @IsCompleted, @TestSession, @SortOrder)
            ON CONFLICT (id) DO UPDATE SET
                name         = EXCLUDED.name,
                notes        = EXCLUDED.notes,
                status       = EXCLUDED.status,
                clickup_id   = EXCLUDED.clickup_id,
                is_completed = EXCLUDED.is_completed,
                test_session = EXCLUDED.test_session,
                sort_order   = EXCLUDED.sort_order
            """, new {
                req.Id, req.Name, req.Notes, req.Status,
                ClickupId   = req.ClickupId,
                IsCompleted = req.IsCompleted,
                TestSession = req.TestSession,
                SortOrder   = req.SortOrder
            }, tx);

        // Kiesett TC-k törlése
        var existingIds = (await conn.QueryAsync<string>(
            "SELECT id FROM test_cases WHERE suite_id = @SuiteId",
            new { SuiteId = req.Id }, tx)).ToHashSet();

        var incomingIds = req.TestCases.Select(t => t.Id).ToHashSet();

        foreach (var oldId in existingIds.Except(incomingIds))
            await conn.ExecuteAsync(
                "DELETE FROM test_cases WHERE id = @Id", new { Id = oldId }, tx);

        // TC-k upsert
        for (int i = 0; i < req.TestCases.Count; i++)
        {
            var tc = req.TestCases[i];

            await conn.ExecuteAsync("""
                INSERT INTO test_cases
                    (id, suite_id, name, steps, expected_result, actual_result, evaluation, sort_order)
                VALUES
                    (@Id, @SuiteId, @Name, @Steps, @ExpectedResult, @ActualResult, @Evaluation, @SortOrder)
                ON CONFLICT (id) DO UPDATE SET
                    name            = EXCLUDED.name,
                    steps           = EXCLUDED.steps,
                    expected_result = EXCLUDED.expected_result,
                    actual_result   = EXCLUDED.actual_result,
                    evaluation      = EXCLUDED.evaluation,
                    sort_order      = EXCLUDED.sort_order
                """, new {
                    tc.Id, SuiteId = req.Id, tc.Name, tc.Steps,
                    ExpectedResult = tc.ExpectedResult,
                    ActualResult   = tc.ActualResult,
                    tc.Evaluation,
                    SortOrder = i
                }, tx);

            // Csatolmányok: töröl + újrafelvesz
            await conn.ExecuteAsync(
                "DELETE FROM attachments WHERE test_case_id = @TcId",
                new { TcId = tc.Id }, tx);

            for (int j = 0; j < tc.Attachments.Count; j++)
            {
                var att = tc.Attachments[j];
                await conn.ExecuteAsync("""
                    INSERT INTO attachments
                        (test_case_id, data_url, file_name, size_px, size_kb, sort_order)
                    VALUES
                        (@TestCaseId, @DataUrl, @FileName, @SizePx, @SizeKb, @SortOrder)
                    """, new {
                        TestCaseId = tc.Id,
                        att.DataUrl, att.FileName, att.SizePx, att.SizeKb,
                        SortOrder = j
                    }, tx);
            }
        }

        await tx.CommitAsync();
    }

    // ── Törlés ─────────────────────────────────────────────────
    public async Task DeleteAsync(string id)
    {
        await using var conn = await db.OpenAsync();
        await conn.ExecuteAsync("DELETE FROM suites WHERE id = @Id", new { Id = id });
    }

    // ── Átrendezés ─────────────────────────────────────────────
    public async Task ReorderAsync(List<string> orderedIds)
    {
        await using var conn = await db.OpenAsync();
        await using var tx   = await conn.BeginTransactionAsync();

        for (int i = 0; i < orderedIds.Count; i++)
            await conn.ExecuteAsync(
                "UPDATE suites SET sort_order = @Order WHERE id = @Id",
                new { Order = i, Id = orderedIds[i] }, tx);

        await tx.CommitAsync();
    }
}
