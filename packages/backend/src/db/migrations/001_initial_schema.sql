CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);

CREATE TABLE hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location geography(POINT, 4326) NOT NULL,
    trauma_capable BOOLEAN DEFAULT false,
    burn_unit BOOLEAN DEFAULT false,
    icu_capacity INTEGER DEFAULT 0,
    icu_available INTEGER DEFAULT 0,
    accepting BOOLEAN DEFAULT true,
    operational_status VARCHAR(50) DEFAULT 'operational',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ambulances (
    id SERIAL PRIMARY KEY,
    base_station_location geography(POINT, 4326) NOT NULL,
    equipment_level VARCHAR(50) NOT NULL,
    crew_level VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'available',
    last_known_position geography(POINT, 4326),
    current_assignment_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE firefighter_units (
    id SERIAL PRIMARY KEY,
    station_location geography(POINT, 4326) NOT NULL,
    available_trucks INTEGER DEFAULT 1,
    specialization TEXT[],
    status VARCHAR(50) DEFAULT 'available',
    last_known_position geography(POINT, 4326),
    current_assignment_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rescue_centers (
    id SERIAL PRIMARY KEY,
    location geography(POINT, 4326) NOT NULL,
    vehicle_inventory JSONB DEFAULT '{}',
    staffing INTEGER DEFAULT 0,
    operational_status VARCHAR(50) DEFAULT 'operational',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    location geography(POINT, 4326) NOT NULL,
    victim_count INTEGER DEFAULT 1,
    severity VARCHAR(50) NOT NULL,
    required_services TEXT[],
    special_needs TEXT[],
    priority INTEGER DEFAULT 1,
    state VARCHAR(50) DEFAULT 'received',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    classified_at TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES incidents(id),
    unit_id INTEGER NOT NULL,
    unit_type VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'assigned',
    eta_seconds INTEGER,
    route_polyline TEXT
);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    actor VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    before_state JSONB,
    after_state JSONB,
    reasoning JSONB
);

CREATE TABLE vehicle_position_history (
    id SERIAL,
    unit_id INTEGER NOT NULL,
    unit_type VARCHAR(50) NOT NULL,
    position geography(POINT, 4326) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create initial partition for vehicle_position_history
-- For simplicity in dev, we will just create a single partition. In prod, this would be managed automatically.
CREATE TABLE vehicle_position_history_y2023m01 PARTITION OF vehicle_position_history FOR VALUES FROM ('2023-01-01') TO ('2030-01-01');

-- Add foreign keys for units' assignments (deferrable or just nullable since it's cyclic with assignments)
ALTER TABLE ambulances ADD CONSTRAINT fk_amb_assignment FOREIGN KEY (current_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
ALTER TABLE firefighter_units ADD CONSTRAINT fk_fire_assignment FOREIGN KEY (current_assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_hospitals_location ON hospitals USING GIST (location);
CREATE INDEX idx_ambulances_location ON ambulances USING GIST (last_known_position);
CREATE INDEX idx_firefighters_location ON firefighter_units USING GIST (last_known_position);
CREATE INDEX idx_incidents_location ON incidents USING GIST (location);

CREATE INDEX idx_incidents_state ON incidents(state);
CREATE INDEX idx_incidents_priority ON incidents(priority DESC);
CREATE INDEX idx_incidents_created_at ON incidents(created_at ASC);

CREATE INDEX idx_assignments_incident_id ON assignments(incident_id);
