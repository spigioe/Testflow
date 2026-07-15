using Dapper;

namespace TestFlow.API.Models;

// Dapper snake_case → PascalCase mapping
public class SnakeCaseMapper : SqlMapper.ITypeMap
{
    private readonly DefaultTypeMap _default;
    public SnakeCaseMapper(Type type) => _default = new DefaultTypeMap(type);

    public ConstructorInfo? FindConstructor(string[] names, Type[] types)
        => _default.FindConstructor(names, types);

    public ConstructorInfo? FindExplicitConstructor()
        => _default.FindExplicitConstructor();

    public SqlMapper.IMemberMap? GetConstructorParameter(ConstructorInfo constructor, string columnName)
        => _default.GetConstructorParameter(constructor, columnName);

    public SqlMapper.IMemberMap? GetMember(string columnName)
    {
        // snake_case → PascalCase: suite_id → SuiteId
        var pascal = string.Concat(columnName.Split('_')
            .Select(s => char.ToUpperInvariant(s[0]) + s[1..]));
        return _default.GetMember(pascal) ?? _default.GetMember(columnName);
    }
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
