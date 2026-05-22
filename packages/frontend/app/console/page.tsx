'use client';
import { useEffect, useState, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const API = 'http://localhost:3002';
const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--status-danger)',
  high: '#f97316',
  medium: '#eab308',
  low: 'var(--status-success)',
  unknown: 'var(--text-muted)',
};

function eta(secs: number) {
  return secs < 60 ? `${secs}s` : `${Math.ceil(secs / 60)} min`;
}

export default function DispatcherConsole() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<number, maplibregl.Marker>>({});
  const unitMarkersRef = useRef<maplibregl.Marker[]>([]);
  const unitsRef = useRef<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [recommendation, setRecommendation] = useState<any | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const fetchIncidents = () =>
    fetch(`${API}/admin/incidents`).then(r => r.json()).then(setIncidents).catch(console.error);

  useEffect(() => { fetchIncidents(); }, []);

  useEffect(() => {
    fetch(`${API}/admin/units`).then(r => r.json()).then(data => {
      unitsRef.current = data;
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3002/ws?token=dispatcher_token`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.channel === 'dispatcher:incidents') fetchIncidents();
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors' } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 22 }]
      },
      center: [35.5, 33.8],
      zoom: 8
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    incidents.forEach(inc => {
      if (!markersRef.current[inc.id]) {
        const el = document.createElement('div');
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${SEVERITY_COLOR[inc.severity] || '#888'};border:2px solid #fff;cursor:pointer`;
        const marker = new maplibregl.Marker({ element: el }).setLngLat([inc.lon, inc.lat]).addTo(map);
        el.addEventListener('click', () => selectIncident(inc));
        markersRef.current[inc.id] = marker;
      }
    });
  }, [incidents]);

  const selectIncident = (inc: any) => {
    setSelected(inc);
    setRecommendation(null);
    if (inc.state === 'classified' || inc.state === 'dispatched') {
      setLoadingRec(true);
      fetch(`${API}/admin/incidents/${inc.id}/recommendation`)
        .then(r => r.json()).then(setRecommendation).catch(console.error).finally(() => setLoadingRec(false));
    }
  };

  const handleDispatch = async () => {
    if (!selected) return;
    setDispatching(true);
    try {
      const res = await fetch(`${API}/admin/incidents/${selected.id}/dispatch`, { method: 'POST' });
      const data = await res.json();
      if (data.dispatched) {
        await fetchIncidents();
        const updated = await fetch(`${API}/admin/incidents/${selected.id}`).then(r => r.json());
        setSelected(updated);
        const rec = await fetch(`${API}/admin/incidents/${selected.id}/recommendation`).then(r => r.json());
        setRecommendation(rec);
      } else {
        alert('Dispatch failed — no available units found.');
      }
    } finally {
      setDispatching(false);
    }
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    unitMarkersRef.current.forEach(m => m.remove());
    unitMarkersRef.current = [];

    const removeLayers = () => {
      if (map.getLayer('candidate-lines')) map.removeLayer('candidate-lines');
      if (map.getLayer('candidate-lines-other')) map.removeLayer('candidate-lines-other');
      if (map.getSource('candidate-lines')) map.removeSource('candidate-lines');
    };

    if (map.loaded()) {
      removeLayers();
    } else {
      map.once('load', removeLayers);
    }

    if (!selected || !recommendation) return;

    let candidates: any[] = [];
    let assignedId: number | null = null;
    
    if (recommendation.status === 'recommendation' && recommendation.candidates) {
      candidates = recommendation.candidates;
    } else if (recommendation.status === 'dispatched' && recommendation.reasoning) {
      candidates = recommendation.reasoning.all_candidates || [];
      assignedId = recommendation.reasoning.assigned_unit;
    }

    if (candidates.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([selected.lon, selected.lat]);

    const features: any[] = [];

    candidates.forEach((c, index) => {
      const unit = unitsRef.current.find(u => u.id === c.id);
      if (!unit) return;

      const isRank1 = assignedId ? c.id === assignedId : index === 0;
      const bgColor = isRank1 ? '#6366f1' : '#94a3b8';
      const label = isRank1 ? '★' : `${index + 1}`;

      const el = document.createElement('div');
      el.style.cssText = `width:20px;height:20px;background:${bgColor};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;cursor:pointer;`;
      el.innerText = label;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([unit.lon, unit.lat])
        .addTo(map);

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(
        `<div style="font-family:sans-serif;font-size:12px;color:#000;">
          <strong>${c.unit_type || unit.type} #${c.id}</strong><br/>
          ETA: ${eta(c.eta || c.etaSeconds)}<br/>
          Score: ${Math.round(c.score * 10) / 10}
        </div>`
      );
      marker.setPopup(popup);

      unitMarkersRef.current.push(marker);
      bounds.extend([unit.lon, unit.lat]);

      features.push({
        type: 'Feature',
        properties: { isRank1 },
        geometry: {
          type: 'LineString',
          coordinates: [[unit.lon, unit.lat], [selected.lon, selected.lat]]
        }
      });
    });

    const addLines = () => {
      if (!map.getSource('candidate-lines')) {
        map.addSource('candidate-lines', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features }
        });
        
        map.addLayer({
          id: 'candidate-lines',
          type: 'line',
          source: 'candidate-lines',
          filter: ['==', ['get', 'isRank1'], true],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': 2
          }
        });

        map.addLayer({
          id: 'candidate-lines-other',
          type: 'line',
          source: 'candidate-lines',
          filter: ['!=', ['get', 'isRank1'], true],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#94a3b8',
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });
      }
    };

    if (map.loaded()) {
      addLines();
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 80 });
    } else {
      map.once('load', () => {
        addLines();
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 80 });
      });
    }

    return () => {
      unitMarkersRef.current.forEach(m => m.remove());
      unitMarkersRef.current = [];
      if (map.loaded()) {
        removeLayers();
      }
    };
  }, [recommendation, selected]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)' }}>
      <div style={{ width: '320px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '1rem', overflowY: 'auto', flexShrink: 0 }}>
        <h2 style={{ marginTop: 0 }}>Active Incidents</h2>
        {incidents.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No active incidents.</p>}
        {incidents.map(inc => (
          <div key={inc.id} onClick={() => selectIncident(inc)} style={{ padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px', cursor: 'pointer', background: selected?.id === inc.id ? 'rgba(255,255,255,0.08)' : 'var(--bg)', border: `1px solid ${selected?.id === inc.id ? 'var(--primary)' : 'var(--border)'}`, borderLeft: `4px solid ${SEVERITY_COLOR[inc.severity] || '#888'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>#{inc.id}</span>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: SEVERITY_COLOR[inc.severity] }}>{inc.severity}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.description}</p>
            <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>State: <strong style={{ color: 'var(--text)' }}>{inc.state}</strong></div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <div ref={mapContainer} className="map-container" style={{ height: '100%' }} />
      </div>

      <div style={{ width: '380px', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', padding: '1rem', overflowY: 'auto', flexShrink: 0 }}>
        {!selected && <p style={{ color: 'var(--text-muted)' }}>Select an incident to view details.</p>}
        {selected && (
          <>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Incident #{selected.id}</p>
              <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>{selected.description}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Severity</span><br /><strong style={{ color: SEVERITY_COLOR[selected.severity] }}>{selected.severity?.toUpperCase()}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Priority</span><br /><strong>{selected.priority}/10</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Services needed</span><br /><strong>{(selected.required_services || []).join(', ') || '—'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Victims</span><br /><strong>{selected.victim_count}</strong></div>
              </div>
            </div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Algorithm Result</h3>
              {loadingRec && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Scoring candidates…</p>}
              {!loadingRec && recommendation?.status === 'recommendation' && (
                <>
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{recommendation.candidates.length} units scored by ETA + equipment match:</p>
                  {recommendation.candidates.map((c: any, i: number) => (
                    <div key={c.id} style={{ marginBottom: '0.4rem', borderRadius: '6px', background: i === 0 ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${i === 0 ? 'var(--primary)' : 'var(--border)'}`, padding: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ fontSize: '1.1rem', width: '24px', textAlign: 'center' }}>{i === 0 ? '★' : `${i + 1}`}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.unit_type} #{c.id}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.equipment_level} · {c.crew_level}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{eta(c.etaSeconds)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>score {Math.round(c.score * 10) / 10}</div>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.5rem' }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, c.score))}%`, height: '100%', background: i === 0 ? '#6366f1' : '#475569' }} />
                      </div>
                    </div>
                  ))}
                </>
              )}
              {!loadingRec && recommendation?.status === 'dispatched' && recommendation.reasoning && (
                <>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--status-success)' }}>✓ Dispatched</p>
                  <div style={{ padding: '0.5rem', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--status-success)', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>Unit #{recommendation.reasoning.assigned_unit}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ETA: {eta(recommendation.reasoning.eta)} · Score: {Math.round(recommendation.reasoning.score * 10) / 10}</div>
                  </div>
                  {recommendation.reasoning.all_candidates?.map((c: any) => {
                    const isAssigned = c.id === recommendation.reasoning.assigned_unit;
                    return (
                      <div key={c.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: isAssigned ? 'var(--primary)' : 'var(--text-muted)' }}>{isAssigned ? '★ ' : ''}unit #{c.id}</span>
                          <span>{eta(c.eta)} · score {Math.round(c.score * 10) / 10}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.25rem' }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, c.score))}%`, height: '100%', background: isAssigned ? '#6366f1' : '#475569' }} />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            {selected.state === 'classified' && (
              <button onClick={handleDispatch} disabled={dispatching || !recommendation?.candidates?.length} style={{ width: '100%', background: 'var(--status-danger)' }}>
                {dispatching ? 'Dispatching…' : `Dispatch ${recommendation?.candidates?.[0] ? `Unit #${recommendation.candidates[0].id}` : 'Units'}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
