FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY TestFlow.API/TestFlow.API.csproj ./TestFlow.API/
RUN dotnet restore ./TestFlow.API/TestFlow.API.csproj

COPY TestFlow.API/ ./TestFlow.API/
RUN dotnet publish ./TestFlow.API/TestFlow.API.csproj -c Release -o /app/publish

# ── Runtime ─────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .
COPY TestFlow.API/appsettings.json .

# Séma másolása mellé (EnsureCreated fallback-re nem támaszkodunk)
COPY ../database/schema.sql .

# Az SQLite fájl a csatolt volume-on lesz
VOLUME /data

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV Database__Path=/data/testflow.db

ENTRYPOINT ["dotnet", "TestFlow.API.dll"]
