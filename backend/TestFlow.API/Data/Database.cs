using Npgsql;
using Dapper;

namespace TestFlow.API.Data;

public class Database
{
    private readonly string _connectionString;

    public Database(IConfiguration config)
    {
        // Render automatikusan beállítja a DATABASE_URL env változót
        // Formátum: postgres://user:pass@host:5432/dbname
        var url = Environment.GetEnvironmentVariable("DATABASE_URL")
               ?? config["Database:ConnectionString"]
               ?? throw new InvalidOperationException(
                    "DATABASE_URL env változó vagy Database:ConnectionString konfig szükséges.");

        // Render postgres:// URL → Npgsql connection string konverzió
        _connectionString = ConvertPostgresUrl(url);

        EnsureCreated();
    }

    public NpgsqlConnection Open()
    {
        var conn = new NpgsqlConnection(_connectionString);
        conn.Open();
        return conn;
    }

    public async Task<NpgsqlConnection> OpenAsync()
    {
        var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();
        return conn;
    }

    private void EnsureCreated()
    {
        using var conn = new NpgsqlConnection(_connectionString);
        conn.Open();
        conn.Execute(Schema);
    }

    // postgres://user:pass@host:port/db → Host=...;Username=...;Password=...
    private static string ConvertPostgresUrl(string url)
{
    if (!url.StartsWith("postgres://") && !url.StartsWith("postgresql://"))
        return url;

    var uri  = new Uri(url);
    var user = uri.UserInfo.Split(':');
    var db   = uri.AbsolutePath.TrimStart('/');

    // Port csak akkor kerül bele, ha ténylegesen meg van adva
    var portPart = uri.Port > 0 ? $"Port={uri.Port};" : "";

    return $"Host={uri.Host};{portPart}Database={db};" +
           $"Username={user[0]};Password={user[1]};" +
           $"SSL Mode=Require;Trust Server Certificate=true;";
}

    private const string Schema = """
        CREATE TABLE IF NOT EXISTS suites (
            id           TEXT        PRIMARY KEY,
            name         TEXT        NOT NULL,
            notes        TEXT        NOT NULL DEFAULT '',
            status       TEXT        NOT NULL DEFAULT '',
            clickup_id   TEXT        NOT NULL DEFAULT '',
            is_completed BOOLEAN     NOT NULL DEFAULT FALSE,
            test_session TEXT                 DEFAULT NULL,
            sort_order   INTEGER     NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS test_cases (
            id              TEXT        PRIMARY KEY,
            suite_id        TEXT        NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
            name            TEXT        NOT NULL,
            steps           TEXT        NOT NULL DEFAULT '',
            expected_result TEXT        NOT NULL DEFAULT '',
            actual_result   TEXT        NOT NULL DEFAULT '',
            evaluation      TEXT        NOT NULL DEFAULT '',
            sort_order      INTEGER     NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id           SERIAL      PRIMARY KEY,
            test_case_id TEXT        NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
            data_url     TEXT        NOT NULL,
            file_name    TEXT        NOT NULL DEFAULT '',
            size_px      TEXT        NOT NULL DEFAULT '',
            size_kb      INTEGER     NOT NULL DEFAULT 0,
            sort_order   INTEGER     NOT NULL DEFAULT 0,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_test_cases_suite_id  ON test_cases(suite_id);
        CREATE INDEX IF NOT EXISTS idx_attachments_tc_id    ON attachments(test_case_id);

        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_suites_updated    ON suites;
        DROP TRIGGER IF EXISTS trg_testcases_updated ON test_cases;

        CREATE TRIGGER trg_suites_updated
            BEFORE UPDATE ON suites
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();

        CREATE TRIGGER trg_testcases_updated
            BEFORE UPDATE ON test_cases
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        """;
}
