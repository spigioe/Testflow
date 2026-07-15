# ── Build stage ─────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY TestFlow.API/TestFlow.API.csproj ./TestFlow.API/
RUN dotnet restore ./TestFlow.API/TestFlow.API.csproj

COPY TestFlow.API/ ./TestFlow.API/
RUN dotnet publish ./TestFlow.API/TestFlow.API.csproj \
    -c Release -o /app/publish \
    --no-restore

# ── Runtime stage ────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# sqlite3 CLI a volume inicializáláshoz (opcionális, debugging)
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .
COPY TestFlow.API/appsettings.json .
COPY TestFlow.API/appsettings.Production.json* .
COPY ../database/schema.sql ./schema.sql

# Volume mount point
RUN mkdir -p /data

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Database__Path=/data/testflow.db

ENTRYPOINT ["dotnet", "TestFlow.API.dll"]
