FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY TestFlow.API/TestFlow.API.csproj ./TestFlow.API/
RUN dotnet restore ./TestFlow.API/TestFlow.API.csproj

COPY TestFlow.API/ ./TestFlow.API/
RUN dotnet publish ./TestFlow.API/TestFlow.API.csproj \
    -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .
COPY TestFlow.API/appsettings.json .
COPY TestFlow.API/appsettings.Production.json* .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "TestFlow.API.dll"]
