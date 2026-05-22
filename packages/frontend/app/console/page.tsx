'use client';
import { useEffect, useState, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function DispatcherConsole() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      },
      center: [35.5, 33.8], // Lebanon
      zoom: 8
    });

    return () => map.remove();
  }, []);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)' }}>
      {/* Left panel */}
      <div style={{ width: '350px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '1rem', overflowY: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Active Incidents</h2>
        {incidents.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active incidents.</p>}
      </div>
      
      {/* Center Map */}
      <div style={{ flex: 1, padding: '1rem' }}>
        <div ref={mapContainer} className="map-container" />
      </div>

      {/* Right panel */}
      <div style={{ width: '350px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Dispatch Details</h2>
        <p style={{ color: 'var(--text-muted)' }}>Select an incident to view recommendation</p>
      </div>
    </div>
  );
}
