using Dapper;
using TestFlow.API.Data;
using TestFlow.API.Models;

// Dapper: PostgreSQL snake_case oszlopok automatikus mappelése
SqlMapper.SetTypeMap(typeof(Suite),     new SnakeCaseMapper(typeof(Suite)));
SqlMapper.SetTypeMap(typeof(TestCase),  new SnakeCaseMapper(typeof(TestCase)));
SqlMapper.SetTypeMap(typeof(Attachment),new SnakeCaseMapper(typeof(Attachment)));

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<Database>();
builder.Services.AddScoped<SuiteRepository>();

// CORS
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

var envOrigin = Environment.GetEnvironmentVariable("FRONTEND_URL");
if (!string.IsNullOrWhiteSpace(envOrigin))
    allowedOrigins = [..allowedOrigins, envOrigin];

if (builder.Environment.IsDevelopment())
    allowedOrigins = ["http://localhost", "http://localhost:3000", "http://localhost:5173"];

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins)
     .AllowAnyOrigin()
     .AllowAnyMethod()
     .AllowAnyHeader()));

var app = builder.Build();

app.UseCors("AllowAll");
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "ok", version = "1.0.0" }));

app.Run();
