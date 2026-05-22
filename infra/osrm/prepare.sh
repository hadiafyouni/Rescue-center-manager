#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DATA_DIR="$DIR/data"

echo "Ensuring data directory exists at $DATA_DIR..."
mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/lebanon-latest.osm.pbf" ]; then
  echo "Downloading Lebanon OSM extract..."
  curl -L -o "$DATA_DIR/lebanon-latest.osm.pbf" https://download.geofabrik.de/asia/lebanon-latest.osm.pbf
else
  echo "OSM extract already downloaded."
fi

# In Docker for Windows, passing a Windows path mapped from bash can be tricky.
# We convert the absolute bash path to a Windows-compatible Docker volume format or use $PWD.
# Since this runs inside $DIR, we can just use $(pwd) mapped locally.
cd "$DIR"
MAPPED_DIR="$(pwd)/data"
# Convert path to Windows format if we are in git bash on windows
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
  MAPPED_DIR=$(cygpath -m "$MAPPED_DIR")
fi

echo "Using mapped dir: $MAPPED_DIR"

echo "Running osrm-extract..."
docker run -t -v "$MAPPED_DIR:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/lebanon-latest.osm.pbf

echo "Running osrm-partition..."
docker run -t -v "$MAPPED_DIR:/data" osrm/osrm-backend osrm-partition /data/lebanon-latest.osrm

echo "Running osrm-customize..."
docker run -t -v "$MAPPED_DIR:/data" osrm/osrm-backend osrm-customize /data/lebanon-latest.osrm

echo "OSRM preparation complete! You can now run docker compose up."
