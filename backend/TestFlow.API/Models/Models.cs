namespace TestFlow.API.Models;

// ── Teszteset halmaz ──────────────────────────────────────────
public record Suite
{
    public string Id          { get; init; } = Guid.NewGuid().ToString();
    public string Name        { get; set; }  = "";
    public string Notes       { get; set; }  = "";
    public string Status      { get; set; }  = "";
    public string ClickupId   { get; set; }  = "";
    public bool   IsCompleted { get; set; }  = false;
    public string? TestSession { get; set; } = null;  // JSON string
    public int    SortOrder   { get; set; }  = 0;

    // Navigation (nem DB oszlop, API válaszban töltjük)
    public List<TestCase> TestCases { get; set; } = [];
}

// ── Teszteset ─────────────────────────────────────────────────
public record TestCase
{
    public string Id             { get; set; } = "";
    public string SuiteId        { get; set; } = "";
    public string Name           { get; set; } = "";
    public string Steps          { get; set; } = "";
    public string ExpectedResult { get; set; } = "";
    public string ActualResult   { get; set; } = "";
    public string Evaluation     { get; set; } = "";
    public int    SortOrder      { get; set; } = 0;

    // Navigation
    public List<Attachment> Attachments { get; set; } = [];
}

// ── Csatolmány ────────────────────────────────────────────────
public record Attachment
{
    public int    Id         { get; init; }
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
