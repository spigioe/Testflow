using TestFlow.API.Data;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSingleton<Database>();
builder.Services.AddScoped<SuiteRepository>();

// CORS – engedélyezett originek konfigból + env változóból
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

// FRONTEND_URL env változóból is olvasható (Fly.io secrets)
var envOrigin = Environment.GetEnvironmentVariable("FRONTEND_URL");
if (!string.IsNullOrWhiteSpace(envOrigin))
    allowedOrigins = [..allowedOrigins, envOrigin];

// Fejlesztői módban mindent engedünk
if (builder.Environment.IsDevelopment())
{
    allowedOrigins = ["http://localhost", "http://localhost:3000", "http://localhost:5173"];
}

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins)
     .AllowAnyMethod()
     .AllowAnyHeader()));

var app = builder.Build();

app.UseCors();
app.MapControllers();

// Egészség-ellenőrzés (Fly.io health check)
app.MapGet("/health", () => Results.Ok(new
{
    status  = "ok",
    version = "1.0.0",
    db      = File.Exists(Environment.GetEnvironmentVariable("Database__Path")
              ?? "/data/testflow.db") ? "exists" : "new"
}));

app.Run();
