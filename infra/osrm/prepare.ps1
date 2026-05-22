$ErrorActionPreference = "Stop"

$DATA_DIR = Join-Path $PSScriptRoot "data"

Write-Host "Ensuring data directory exists at $DATA_DIR..."
if (-not (Test-Path $DATA_DIR)) {
    New-Item -ItemType Directory -Path $DATA_DIR | Out-Null
}

$PBF_FILE = Join-Path $DATA_DIR "lebanon-latest.osm.pbf"
if (-not (Test-Path $PBF_FILE)) {
    Write-Host "Downloading Lebanon OSM extract..."
    Invoke-WebRequest -Uri "https://download.geofabrik.de/asia/lebanon-latest.osm.pbf" -OutFile $PBF_FILE
} else {
    Write-Host "OSM extract already downloaded."
}

# Convert Windows path to Docker-compatible format (forward slashes)
$DOCKER_VOLUME = "$($DATA_DIR -replace '\\','/'):/data"

Write-Host "Running osrm-extract..."
docker run -t -v $DOCKER_VOLUME osrm/osrm-backend osrm-extract -p /opt/car.lua /data/lebanon-latest.osm.pbf
if ($LASTEXITCODE -ne 0) { throw "osrm-extract failed" }

Write-Host "Running osrm-partition..."
docker run -t -v $DOCKER_VOLUME osrm/osrm-backend osrm-partition /data/lebanon-latest.osrm
if ($LASTEXITCODE -ne 0) { throw "osrm-partition failed" }

Write-Host "Running osrm-customize..."
docker run -t -v $DOCKER_VOLUME osrm/osrm-backend osrm-customize /data/lebanon-latest.osrm
if ($LASTEXITCODE -ne 0) { throw "osrm-customize failed" }

Write-Host "OSRM preparation complete! You can now run: npm run infra:up"
