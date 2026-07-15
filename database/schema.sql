-- ============================================================
--  TestFlow – SQLite adatbázis séma
--  Verzió: 1.0.0
--  Létrehozás: automatikus az alkalmazás első indításakor
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
--  Teszteset halmazok
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Suites (
    Id            TEXT    PRIMARY KEY,          -- UUID v4
    Name          TEXT    NOT NULL,
    Notes         TEXT    NOT NULL DEFAULT '',
    Status        TEXT    NOT NULL DEFAULT '',
    ClickupId     TEXT    NOT NULL DEFAULT '',
    IsCompleted   INTEGER NOT NULL DEFAULT 0,   -- 0 / 1
    TestSession   TEXT             DEFAULT NULL, -- JSON blob (folytatási pont)
    SortOrder     INTEGER NOT NULL DEFAULT 0,   -- kártyák sorrendje
    CreatedAt     TEXT    NOT NULL DEFAULT (datetime('now')),
    UpdatedAt     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
--  Tesztesetek
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TestCases (
    Id             TEXT    PRIMARY KEY,          -- pl. TC-001
    SuiteId        TEXT    NOT NULL REFERENCES Suites(Id) ON DELETE CASCADE,
    Name           TEXT    NOT NULL,
    Steps          TEXT    NOT NULL DEFAULT '',
    ExpectedResult TEXT    NOT NULL DEFAULT '',
    ActualResult   TEXT    NOT NULL DEFAULT '',
    Evaluation     TEXT    NOT NULL DEFAULT '',  -- Sikeres / Sikertelen / Megbeszélésre vár / ''
    SortOrder      INTEGER NOT NULL DEFAULT 0,
    CreatedAt      TEXT    NOT NULL DEFAULT (datetime('now')),
    UpdatedAt      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_testcases_suiteid ON TestCases(SuiteId);

-- ------------------------------------------------------------
--  Csatolmányok (képek Base64-ben)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Attachments (
    Id          INTEGER PRIMARY KEY AUTOINCREMENT,
    TestCaseId  TEXT    NOT NULL REFERENCES TestCases(Id) ON DELETE CASCADE,
    DataUrl     TEXT    NOT NULL,               -- data:image/jpeg;base64,...
    FileName    TEXT    NOT NULL DEFAULT '',
    SizePx      TEXT    NOT NULL DEFAULT '',    -- pl. "1280x720"
    SizeKb      INTEGER NOT NULL DEFAULT 0,
    SortOrder   INTEGER NOT NULL DEFAULT 0,
    CreatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_testcaseid ON Attachments(TestCaseId);

-- ------------------------------------------------------------
--  Trigger: UpdatedAt automatikus frissítése
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_suites_updated
    AFTER UPDATE ON Suites
    FOR EACH ROW
BEGIN
    UPDATE Suites SET UpdatedAt = datetime('now') WHERE Id = OLD.Id;
END;

CREATE TRIGGER IF NOT EXISTS trg_testcases_updated
    AFTER UPDATE ON TestCases
    FOR EACH ROW
BEGIN
    UPDATE TestCases SET UpdatedAt = datetime('now') WHERE Id = OLD.Id;
END;
