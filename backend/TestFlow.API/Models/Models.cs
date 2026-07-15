using System.Reflection;
using Dapper;

namespace TestFlow.API.Models;

// ── Snake_case → PascalCase Dapper mapper ────────────────────
// Dapper az adatbázis oszlopneveit (snake_case) mappeli a C# property-kre
public class SnakeCaseMapper : SqlMapper.ITypeMap
{
    private readonly DefaultTypeMap _inner;
    public SnakeCaseMapper(Type type) => _inner = new DefaultTypeMap(type);

    // snake_case → PascalCase konverzió (suite_id → SuiteId)
    private static string ToPascal(string col) =>
        string.Concat(col.Split('_').Select(w =>
            w.Length > 0 ? char.ToUpperInvariant(w[0]) + w[1..] : w));

    public ConstructorInfo? FindConstructor(string[] names, Type[] types)
        => _inner.FindConstructor(names, types);

    public ConstructorInfo? FindExplicitConstructor()
        => _inner.FindExplicitConstructor();

    public SqlMapper.IMemberMap? GetConstructorParameter(ConstructorInfo constructor, string columnName)
        => _inner.GetConstructorParameter(constructor, ToPascal(columnName))
        ?? _inner.GetConstructorParameter(constructor, columnName);

    public SqlMapper.IMemberMap? GetMember(string columnName)
        => _inner.GetMember(ToPascal(columnName))
        ?? _inner.GetMember(columnName);
}

// ── Domain modellek ──────────────────────────────────────────
public class Suite
{
    public string  Id          { get; set; } = Guid.NewGuid().ToString();
    public string  Name        { get; set; } = "";
    public string  Notes       { get; set; } = "";
    public string  Status      { get; set; } = "";
    public string  ClickupId   { get; set; } = "";
    public bool    IsCompleted { get; set; } = false;
    public string? TestSession { get; set; } = null;
    public int     SortOrder   { get; set; } = 0;

    public List<TestCase> TestCases { get; set; } = [];
}

public class TestCase
{
    public string Id             { get; set; } = "";
    public string SuiteId        { get; set; } = "";
    public string Name           { get; set; } = "";
    public string Steps          { get; set; } = "";
    public string ExpectedResult { get; set; } = "";
    public string ActualResult   { get; set; } = "";
    public string Evaluation     { get; set; } = "";
    public int    SortOrder      { get; set; } = 0;

    public List<Attachment> Attachments { get; set; } = [];
}

public class Attachment
{
    public int    Id         { get; set; }
    public string TestCaseId { get; set; } = "";
    public string DataUrl    { get; set; } = "";
    public string FileName   { get; set; } = "";
    public string SizePx     { get; set; } = "";
    public int    SizeKb     { get; set; } = 0;
    public int    SortOrder  { get; set; } = 0;
}

// ── Request DTO-k ─────────────────────────────────────────────
public record UpsertSuiteRequest(
    string  Id,
    string  Name,
    string  Notes,
    string  Status,
    string  ClickupId,
    bool    IsCompleted,
    string? TestSession,
    int     SortOrder,
    List<TestCaseDto> TestCases
);

public record TestCaseDto(
    string Id,
    string Name,
    string Steps,
    string ExpectedResult,
    string ActualResult,
    string Evaluation,
    int    SortOrder,
    List<AttachmentDto> Attachments
);

public record AttachmentDto(
    string DataUrl,
    string FileName,
    string SizePx,
    int    SizeKb,
    int    SortOrder
);

public record ReorderRequest(List<string> Ids);
