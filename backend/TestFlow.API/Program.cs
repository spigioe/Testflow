using TestFlow.API.Data;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSingleton<Database>();
builder.Services.AddScoped<SuiteRepository>();

// CORS: a frontend nginx konténerből érhető el
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(
        "http://localhost",
        "http://localhost:80",
        "http://frontend"        // Docker service neve
    )
    .AllowAnyMethod()
    .AllowAnyHeader()));

var app = builder.Build();

app.UseCors();
app.MapControllers();

// Egészség-ellenőrzés
app.MapGet("/health", () => Results.Ok(new { status = "ok", version = "1.0.0" }));

app.Run();
