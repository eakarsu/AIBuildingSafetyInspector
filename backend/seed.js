const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'building_safety_inspector',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function seed() {
  if (process.env.CONFIRM_DEMO_SEED !== 'yes' || process.env.NODE_ENV === 'production') throw new Error('Demo seed requires CONFIRM_DEMO_SEED=yes outside production');
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12) throw new Error('DEMO_PASSWORD must contain at least 12 characters');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop tables
    await client.query(`
      DROP TABLE IF EXISTS ai_analyses CASCADE;
      DROP TABLE IF EXISTS daily_reports CASCADE;
      DROP TABLE IF EXISTS corrective_actions CASCADE;
      DROP TABLE IF EXISTS ppe_inventory CASCADE;
      DROP TABLE IF EXISTS emergency_plans CASCADE;
      DROP TABLE IF EXISTS compliance_documents CASCADE;
      DROP TABLE IF EXISTS hazard_assessments CASCADE;
      DROP TABLE IF EXISTS safety_training CASCADE;
      DROP TABLE IF EXISTS worker_certifications CASCADE;
      DROP TABLE IF EXISTS equipment_inspections CASCADE;
      DROP TABLE IF EXISTS incident_reports CASCADE;
      DROP TABLE IF EXISTS safety_checklists CASCADE;
      DROP TABLE IF EXISTS violations CASCADE;
      DROP TABLE IF EXISTS site_inspections CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Users
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'inspector',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const hash = await bcrypt.hash(process.env.DEMO_PASSWORD, 10);
    await client.query(`INSERT INTO users (email, password, full_name, role) VALUES
      ('admin@safetyfirst.com', $1, 'John Administrator', 'admin'),
      ('inspector@safetyfirst.com', $1, 'Jane Inspector', 'inspector'),
      ('manager@safetyfirst.com', $1, 'Bob Manager', 'manager')
    `, [hash]);

    // 1. Site Inspections
    await client.query(`
      CREATE TABLE site_inspections (
        id SERIAL PRIMARY KEY,
        site_name VARCHAR(255) NOT NULL,
        site_address VARCHAR(500) NOT NULL,
        inspector_name VARCHAR(255) NOT NULL,
        inspection_date DATE NOT NULL,
        inspection_type VARCHAR(100) NOT NULL,
        overall_rating VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        findings TEXT,
        recommendations TEXT,
        weather_conditions VARCHAR(100),
        num_workers_onsite INTEGER,
        next_inspection_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO site_inspections (site_name, site_address, inspector_name, inspection_date, inspection_type, overall_rating, status, findings, recommendations, weather_conditions, num_workers_onsite, next_inspection_date) VALUES
      ('Skyline Tower Project', '1200 Main St, New York, NY', 'Jane Inspector', '2024-03-15', 'Routine', 'Satisfactory', 'completed', 'All scaffolding properly secured. Minor debris on level 12.', 'Schedule debris cleanup on level 12.', 'Clear, 72°F', 145, '2024-04-15'),
      ('Harbor Bridge Renovation', '500 Harbor Blvd, San Francisco, CA', 'Mike Chen', '2024-03-14', 'Safety Audit', 'Needs Improvement', 'in_progress', 'Fall protection gaps on east side. Guardrails missing at 3 locations.', 'Install temporary guardrails immediately. Update fall protection plan.', 'Foggy, 58°F', 89, '2024-03-21'),
      ('Metro Hospital Wing B', '800 Health Ave, Chicago, IL', 'Sarah Williams', '2024-03-13', 'Pre-Construction', 'Good', 'completed', 'Site properly fenced. Utility markings verified. Soil test results adequate.', 'Proceed with excavation phase.', 'Overcast, 45°F', 32, '2024-04-13'),
      ('Riverside Mall Expansion', '2100 River Rd, Houston, TX', 'Tom Garcia', '2024-03-12', 'Routine', 'Excellent', 'completed', 'All safety protocols followed. Excellent housekeeping.', 'Continue current safety program.', 'Sunny, 80°F', 200, '2024-04-12'),
      ('Central Park Condos', '450 Park Lane, Boston, MA', 'Jane Inspector', '2024-03-11', 'Follow-up', 'Satisfactory', 'completed', 'Previous violations corrected. New electrical panel installed per code.', 'Monitor electrical work on floors 8-12.', 'Rainy, 50°F', 78, '2024-04-11'),
      ('Airport Terminal C', '1 Airport Way, Denver, CO', 'Mike Chen', '2024-03-10', 'Safety Audit', 'Good', 'completed', 'Active runway proximity protocols in place. Noise barriers effective.', 'Add additional signage near taxiway.', 'Clear, 55°F', 310, '2024-03-24'),
      ('Oceanview Resort', '9000 Beach Dr, Miami, FL', 'Sarah Williams', '2024-03-09', 'Routine', 'Needs Improvement', 'action_required', 'Hurricane tie-downs incomplete on roof structure. Crane certification expired.', 'Stop crane operations until recertified. Complete tie-downs within 48 hours.', 'Humid, 85°F', 120, '2024-03-16'),
      ('Tech Campus Building 4', '5500 Innovation Blvd, Austin, TX', 'Tom Garcia', '2024-03-08', 'Pre-Construction', 'Excellent', 'completed', 'Environmental assessment complete. All permits verified.', 'Begin foundation work as planned.', 'Clear, 75°F', 15, '2024-04-08'),
      ('Historic Library Restoration', '100 Heritage St, Philadelphia, PA', 'Jane Inspector', '2024-03-07', 'Specialty', 'Good', 'in_progress', 'Lead paint containment protocols active. Asbestos abatement on schedule.', 'Continue air quality monitoring daily.', 'Cloudy, 42°F', 45, '2024-03-21'),
      ('Mountain View Apartments', '3300 Summit Dr, Seattle, WA', 'Mike Chen', '2024-03-06', 'Routine', 'Satisfactory', 'completed', 'Retaining wall construction meets specs. Drainage system properly installed.', 'Verify compaction tests for lot B.', 'Rainy, 48°F', 65, '2024-04-06'),
      ('Interstate Bridge 95', 'I-95 Mile Marker 120, Baltimore, MD', 'Sarah Williams', '2024-03-05', 'Safety Audit', 'Needs Improvement', 'action_required', 'Traffic control plan inadequate. Night work lighting insufficient.', 'Revise TCP and add 4 light towers for night shifts.', 'Clear, 38°F', 40, '2024-03-12'),
      ('Solar Farm Installation', '7700 Desert Rd, Phoenix, AZ', 'Tom Garcia', '2024-03-04', 'Routine', 'Excellent', 'completed', 'Heat illness prevention plan active. Hydration stations properly maintained.', 'Maintain current protocols. Increase water supply for summer.', 'Sunny, 95°F', 85, '2024-04-04'),
      ('Subway Extension Line 3', 'Underground Sector 7, New York, NY', 'Jane Inspector', '2024-03-03', 'Specialty', 'Satisfactory', 'completed', 'Tunnel support structures stable. Ventilation system functional.', 'Increase air quality tests during blasting.', 'N/A Underground', 55, '2024-03-17'),
      ('Waterfront Office Complex', '600 Dock St, Portland, OR', 'Mike Chen', '2024-03-02', 'Follow-up', 'Good', 'completed', 'Previous scaffolding issues resolved. New safety nets installed.', 'Conduct load test on scaffolding level 6.', 'Overcast, 52°F', 92, '2024-04-02'),
      ('Community Center Rebuild', '250 Community Blvd, Atlanta, GA', 'Sarah Williams', '2024-03-01', 'Pre-Construction', 'Satisfactory', 'completed', 'Demolition complete. Site cleared. Soil remediation verified.', 'Proceed with foundation layout.', 'Partly Cloudy, 65°F', 28, '2024-04-01'),
      ('Data Center Facility', '8800 Server Rd, Dallas, TX', 'Tom Garcia', '2024-02-28', 'Routine', 'Good', 'completed', 'Raised floor installation on schedule. Fire suppression system tested.', 'Verify UPS battery room ventilation.', 'Clear, 70°F', 110, '2024-03-28')
    `);

    // 2. Violations
    await client.query(`
      CREATE TABLE violations (
        id SERIAL PRIMARY KEY,
        violation_code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(50) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        location_detail VARCHAR(255),
        date_identified DATE NOT NULL,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'open',
        assigned_to VARCHAR(255),
        fine_amount DECIMAL(10,2),
        osha_standard VARCHAR(100),
        corrective_action TEXT,
        photo_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO violations (violation_code, title, description, severity, site_name, location_detail, date_identified, due_date, status, assigned_to, fine_amount, osha_standard, corrective_action) VALUES
      ('OSHA-1926.501', 'Fall Protection Missing', 'Workers observed on elevated platform without fall protection harnesses', 'critical', 'Harbor Bridge Renovation', 'East Wing Level 4', '2024-03-14', '2024-03-15', 'open', 'Mike Chen', 156000.00, '1926.501(b)(1)', 'Install guardrails and provide harnesses'),
      ('OSHA-1926.451', 'Scaffolding Deficiency', 'Scaffold planks not fully decked, gaps exceeding 1 inch', 'major', 'Skyline Tower Project', 'Floor 12 North Side', '2024-03-13', '2024-03-20', 'in_progress', 'Jane Inspector', 15625.00, '1926.451(b)', 'Replace scaffold planks and inspect all levels'),
      ('OSHA-1926.1053', 'Ladder Safety Violation', 'Extension ladder not secured at top, extending only 2 feet above landing', 'moderate', 'Central Park Condos', 'Stairwell B', '2024-03-12', '2024-03-19', 'resolved', 'Tom Garcia', 7500.00, '1926.1053(b)(1)', 'Secure ladder and extend 3 feet above landing'),
      ('OSHA-1926.62', 'Lead Exposure', 'Workers in lead abatement area without proper respiratory protection', 'critical', 'Historic Library Restoration', 'West Reading Room', '2024-03-11', '2024-03-12', 'open', 'Sarah Williams', 156000.00, '1926.62(d)', 'Provide P100 respirators and blood lead level testing'),
      ('OSHA-1926.651', 'Excavation Hazard', 'Trench deeper than 5 feet without protective system', 'critical', 'Metro Hospital Wing B', 'Utility Trench East', '2024-03-10', '2024-03-11', 'resolved', 'Mike Chen', 75000.00, '1926.651(j)(2)', 'Install trench box before work resumes'),
      ('OSHA-1910.147', 'Lockout/Tagout Failure', 'Electrical panel not locked out during maintenance', 'major', 'Tech Campus Building 4', 'Mechanical Room 3', '2024-03-09', '2024-03-16', 'in_progress', 'Jane Inspector', 25000.00, '1910.147(c)(4)', 'Implement LOTO procedures and retrain workers'),
      ('OSHA-1926.502', 'Guardrail Missing', 'Floor opening on 6th floor without guardrail protection', 'critical', 'Mountain View Apartments', 'Floor 6 Elevator Shaft', '2024-03-08', '2024-03-09', 'resolved', 'Tom Garcia', 100000.00, '1926.502(b)(1)', 'Install guardrails around all floor openings'),
      ('OSHA-1926.54', 'Crane Certification Expired', 'Tower crane operator certification expired 30 days ago', 'major', 'Oceanview Resort', 'Main Tower Crane', '2024-03-07', '2024-03-14', 'open', 'Sarah Williams', 35000.00, '1926.1427(a)', 'Remove operator until recertified'),
      ('OSHA-1926.404', 'Electrical Grounding', 'Temporary power distribution panel not properly grounded', 'major', 'Riverside Mall Expansion', 'Loading Dock Area', '2024-03-06', '2024-03-13', 'in_progress', 'Mike Chen', 18000.00, '1926.404(b)(1)', 'Ground all temporary electrical systems'),
      ('OSHA-1926.95', 'PPE Non-Compliance', 'Multiple workers without hard hats in active construction zone', 'moderate', 'Airport Terminal C', 'Gate C12 Area', '2024-03-05', '2024-03-12', 'resolved', 'Jane Inspector', 5000.00, '1926.100(a)', 'Enforce PPE policy and provide additional hard hats'),
      ('OSHA-1926.602', 'Equipment Safety', 'Forklift operating without backup alarm', 'moderate', 'Data Center Facility', 'Loading Area B', '2024-03-04', '2024-03-11', 'open', 'Tom Garcia', 8500.00, '1926.602(a)(9)', 'Repair or replace backup alarm before operation'),
      ('OSHA-1926.152', 'Flammable Storage', 'Flammable liquids stored improperly near ignition sources', 'major', 'Community Center Rebuild', 'Storage Area', '2024-03-03', '2024-03-10', 'in_progress', 'Sarah Williams', 22000.00, '1926.152(a)(1)', 'Relocate flammable storage to approved cabinet'),
      ('OSHA-1926.251', 'Rigging Deficiency', 'Wire rope sling with visible broken wires still in use', 'critical', 'Subway Extension Line 3', 'Tunnel Section 4', '2024-03-02', '2024-03-03', 'resolved', 'Mike Chen', 45000.00, '1926.251(c)(4)', 'Remove damaged sling and inspect all rigging'),
      ('OSHA-1926.21', 'Training Deficiency', 'Workers not trained on hazard communication program', 'moderate', 'Solar Farm Installation', 'Panel Array Section 7', '2024-03-01', '2024-03-08', 'open', 'Jane Inspector', 12000.00, '1926.21(b)(2)', 'Conduct HazCom training for all workers'),
      ('OSHA-1926.1101', 'Asbestos Exposure', 'Asbestos containing materials disturbed without proper controls', 'critical', 'Waterfront Office Complex', 'Basement Level', '2024-02-28', '2024-02-29', 'resolved', 'Tom Garcia', 156000.00, '1926.1101(g)', 'Stop work, contain area, hire licensed abatement contractor'),
      ('OSHA-1926.200', 'Signage Missing', 'Construction site missing required danger and warning signs', 'minor', 'Interstate Bridge 95', 'Work Zone Entry', '2024-02-27', '2024-03-06', 'open', 'Sarah Williams', 3500.00, '1926.200(b)', 'Install required signage at all entry points')
    `);

    // 3. Safety Checklists
    await client.query(`
      CREATE TABLE safety_checklists (
        id SERIAL PRIMARY KEY,
        checklist_name VARCHAR(255) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        assigned_to VARCHAR(255),
        due_date DATE,
        completion_percentage INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        total_items INTEGER NOT NULL,
        completed_items INTEGER DEFAULT 0,
        notes TEXT,
        priority VARCHAR(50) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO safety_checklists (checklist_name, site_name, category, assigned_to, due_date, completion_percentage, status, total_items, completed_items, notes, priority) VALUES
      ('Daily Fall Protection Inspection', 'Skyline Tower Project', 'Fall Protection', 'Jane Inspector', '2024-03-15', 100, 'completed', 12, 12, 'All anchor points tested and verified', 'high'),
      ('Scaffolding Pre-Use Checklist', 'Harbor Bridge Renovation', 'Scaffolding', 'Mike Chen', '2024-03-15', 75, 'in_progress', 20, 15, 'Base plates need re-leveling on east side', 'critical'),
      ('Excavation Safety Checklist', 'Metro Hospital Wing B', 'Excavation', 'Sarah Williams', '2024-03-14', 100, 'completed', 15, 15, 'Soil classified as Type B. Shoring in place.', 'high'),
      ('Electrical Safety Inspection', 'Tech Campus Building 4', 'Electrical', 'Tom Garcia', '2024-03-14', 60, 'in_progress', 18, 11, 'GFCI testing incomplete for floor 2', 'high'),
      ('Fire Prevention Plan Review', 'Riverside Mall Expansion', 'Fire Safety', 'Jane Inspector', '2024-03-13', 100, 'completed', 10, 10, 'All extinguishers inspected and tagged', 'medium'),
      ('Crane Operations Daily Check', 'Oceanview Resort', 'Heavy Equipment', 'Mike Chen', '2024-03-13', 0, 'overdue', 25, 0, 'Crane certification expired - cannot perform check', 'critical'),
      ('Confined Space Entry Permit', 'Subway Extension Line 3', 'Confined Space', 'Sarah Williams', '2024-03-12', 90, 'in_progress', 22, 20, 'Air monitoring equipment needs calibration', 'critical'),
      ('PPE Compliance Audit', 'Airport Terminal C', 'PPE', 'Tom Garcia', '2024-03-12', 100, 'completed', 8, 8, 'All workers compliant after retraining', 'medium'),
      ('Housekeeping Inspection', 'Central Park Condos', 'General Safety', 'Jane Inspector', '2024-03-11', 85, 'in_progress', 14, 12, 'Debris removal needed in stairwell C', 'low'),
      ('Hazardous Materials Check', 'Historic Library Restoration', 'HazMat', 'Mike Chen', '2024-03-11', 100, 'completed', 16, 16, 'All containment barriers verified', 'critical'),
      ('Equipment Maintenance Log', 'Solar Farm Installation', 'Equipment', 'Sarah Williams', '2024-03-10', 50, 'in_progress', 20, 10, 'Hydraulic systems due for service', 'medium'),
      ('Noise Level Assessment', 'Data Center Facility', 'Health', 'Tom Garcia', '2024-03-10', 100, 'completed', 6, 6, 'All areas below 85dB threshold', 'low'),
      ('Emergency Egress Verification', 'Community Center Rebuild', 'Emergency', 'Jane Inspector', '2024-03-09', 100, 'completed', 10, 10, 'All exit routes clear and marked', 'high'),
      ('Welding Safety Checklist', 'Waterfront Office Complex', 'Hot Work', 'Mike Chen', '2024-03-09', 70, 'in_progress', 12, 8, 'Fire watch procedures need review', 'high'),
      ('Traffic Control Plan Review', 'Interstate Bridge 95', 'Traffic Safety', 'Sarah Williams', '2024-03-08', 40, 'overdue', 15, 6, 'Signage placement does not meet MUTCD standards', 'critical'),
      ('Ladder Inspection Checklist', 'Mountain View Apartments', 'Fall Protection', 'Tom Garcia', '2024-03-08', 100, 'completed', 8, 8, 'All ladders tagged and inspected', 'medium')
    `);

    // 4. Incident Reports
    await client.query(`
      CREATE TABLE incident_reports (
        id SERIAL PRIMARY KEY,
        incident_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        incident_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        location_detail VARCHAR(255),
        incident_date TIMESTAMP NOT NULL,
        reported_by VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        injuries_count INTEGER DEFAULT 0,
        injury_details TEXT,
        root_cause TEXT,
        immediate_actions TEXT,
        witnesses TEXT,
        status VARCHAR(50) DEFAULT 'reported',
        osha_recordable BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO incident_reports (incident_number, title, incident_type, severity, site_name, location_detail, incident_date, reported_by, description, injuries_count, injury_details, root_cause, immediate_actions, witnesses, status, osha_recordable) VALUES
      ('INC-2024-001', 'Worker Fall from Scaffold', 'Fall', 'critical', 'Harbor Bridge Renovation', 'East Platform Level 3', '2024-03-14 10:30:00', 'Mike Chen', 'Worker fell approximately 8 feet from scaffold platform when plank shifted. Worker was wearing harness but lanyard was not attached.', 1, 'Fractured left wrist, minor abrasions', 'Scaffold plank not properly secured; worker failed to attach lanyard', 'Called 911. Secured area. Transported to hospital.', 'John Doe, Mary Smith', 'under_investigation', true),
      ('INC-2024-002', 'Electrical Arc Flash', 'Electrical', 'major', 'Tech Campus Building 4', 'Electrical Room 2B', '2024-03-12 14:15:00', 'Tom Garcia', 'Arc flash occurred during panel installation. Worker was wearing appropriate PPE.', 0, 'No injuries due to proper PPE', 'Failure to verify circuit was de-energized', 'Power shut off to entire wing. Equipment quarantined.', 'Bob Johnson', 'resolved', false),
      ('INC-2024-003', 'Crane Near Miss', 'Near Miss', 'major', 'Oceanview Resort', 'Main Construction Area', '2024-03-11 09:45:00', 'Sarah Williams', 'Crane load swung within 3 feet of occupied scaffold during high wind conditions.', 0, 'No injuries', 'Wind speed exceeded safe operating limits; operator did not check conditions', 'Crane operations suspended. Wind monitoring protocol implemented.', 'Carlos Rivera, Amy Lee', 'under_investigation', false),
      ('INC-2024-004', 'Trench Collapse', 'Cave-in', 'critical', 'Metro Hospital Wing B', 'Utility Trench East', '2024-03-10 11:00:00', 'Mike Chen', 'Partial trench wall collapse trapped one worker up to waist level.', 1, 'Bruised ribs, no fractures', 'Trench box not extended to full depth; recent rain weakened soil', 'Manual extraction. Medical evaluation. Trench secured with proper shoring.', 'Frank Torres, Lisa Wang', 'resolved', true),
      ('INC-2024-005', 'Chemical Spill', 'HazMat', 'moderate', 'Historic Library Restoration', 'Basement Level', '2024-03-09 16:00:00', 'Jane Inspector', '5 gallons of solvent spilled when container was knocked over by equipment.', 0, 'No injuries', 'Improper storage location; container not secured', 'Area evacuated. Spill contained with absorbent. Ventilation activated.', 'Greg Patel', 'resolved', false),
      ('INC-2024-006', 'Heat Exhaustion', 'Health', 'moderate', 'Solar Farm Installation', 'Panel Array Section 3', '2024-03-08 13:30:00', 'Tom Garcia', 'Worker experienced dizziness and nausea after 4 hours in direct sun. Temperature was 102°F.', 1, 'Heat exhaustion - recovered after treatment', 'Inadequate rest breaks; insufficient hydration', 'Moved to shade. Provided water and cooling. Sent home for day.', 'Maria Gonzalez', 'resolved', true),
      ('INC-2024-007', 'Struck-By Falling Object', 'Struck-By', 'major', 'Skyline Tower Project', 'Ground Level North', '2024-03-07 08:20:00', 'Sarah Williams', 'Wrench dropped from Floor 15 struck worker on hard hat. Hard hat prevented head injury.', 1, 'Neck strain from impact', 'Tool tether not used; no overhead protection canopy', 'Area cleared. Tool tethering policy enforced. Canopy being installed.', 'Dave Kim, Rachel Adams', 'under_investigation', true),
      ('INC-2024-008', 'Vehicle Accident', 'Vehicle', 'moderate', 'Airport Terminal C', 'Access Road B', '2024-03-06 07:00:00', 'Mike Chen', 'Dump truck backed into construction trailer. No personnel in trailer at time.', 0, 'No injuries', 'Spotter not assigned for backing operations', 'Trailer assessed for damage. Backing procedures revised.', 'Steve Park', 'resolved', false),
      ('INC-2024-009', 'Silica Dust Exposure', 'Health', 'major', 'Community Center Rebuild', 'Foundation Work Area', '2024-03-05 10:45:00', 'Jane Inspector', 'Concrete cutting without water suppression generated excessive silica dust.', 3, 'Three workers exposed - sent for medical monitoring', 'Water suppression system not set up; workers not wearing respirators', 'Work stopped. Air monitoring initiated. Workers sent for evaluation.', 'Tony Martinez', 'under_investigation', true),
      ('INC-2024-010', 'Caught-In Equipment', 'Caught-In', 'critical', 'Riverside Mall Expansion', 'Steel Erection Area', '2024-03-04 15:30:00', 'Tom Garcia', 'Worker caught hand in conveyor belt. Emergency stop activated by coworker.', 1, 'Laceration to right hand - required 12 stitches', 'Machine guard removed and not replaced after maintenance', 'First aid administered. Transported to ER. Machine locked out.', 'Nancy Chen, Paul Wright', 'resolved', true),
      ('INC-2024-011', 'Scaffolding Collapse', 'Structural', 'critical', 'Waterfront Office Complex', 'South Facade Level 5', '2024-03-03 12:00:00', 'Sarah Williams', 'Two-bay scaffold section collapsed during material loading. Estimated 800 lbs overload.', 2, 'Worker 1: Broken ankle. Worker 2: Bruised shoulder.', 'Scaffold loaded beyond rated capacity; no load limit signage', 'Area evacuated. Injured treated. All scaffolding reinspected.', 'Multiple witnesses', 'under_investigation', true),
      ('INC-2024-012', 'Fire - Welding Spark', 'Fire', 'major', 'Data Center Facility', 'Server Room Construction', '2024-03-02 11:15:00', 'Mike Chen', 'Welding spark ignited insulation material. Small fire extinguished in 2 minutes.', 0, 'No injuries', 'Fire blanket not deployed; combustible materials not cleared', 'Fire extinguished. Hot work permit process reviewed.', 'Kim Lee', 'resolved', false),
      ('INC-2024-013', 'Noise Overexposure', 'Health', 'minor', 'Subway Extension Line 3', 'Tunnel Section 2', '2024-03-01 09:00:00', 'Jane Inspector', 'Noise levels recorded at 98dB for 6-hour shift. Workers had earplugs but not earmuffs.', 5, 'Five workers potentially overexposed - audiometric testing scheduled', 'Single hearing protection insufficient for noise levels', 'Dual hearing protection provided. Shift duration reduced.', 'None listed', 'resolved', true),
      ('INC-2024-014', 'Slip and Fall', 'Fall', 'minor', 'Mountain View Apartments', 'Parking Garage Level 1', '2024-02-29 14:00:00', 'Tom Garcia', 'Worker slipped on wet concrete surface. Fell on same level.', 1, 'Bruised knee - returned to work same day', 'Wet surface not barricaded or signed', 'Wet floor signs placed. Non-slip mats provided.', 'Alex Turner', 'resolved', false),
      ('INC-2024-015', 'Utility Strike', 'Utility', 'major', 'Central Park Condos', 'East Parking Area', '2024-02-28 08:30:00', 'Sarah Williams', 'Excavator struck unmarked gas line. Gas leak required evacuation.', 0, 'No injuries - immediate evacuation', 'Utility marking incomplete; hand digging not performed near utilities', 'Gas company called. Area evacuated 500ft. Line repaired.', 'Brian Moore, Cindy Park', 'resolved', false),
      ('INC-2024-016', 'Falling Debris', 'Struck-By', 'moderate', 'Interstate Bridge 95', 'Northbound Lane Work Zone', '2024-02-27 16:45:00', 'Mike Chen', 'Concrete chunk fell from bridge deck onto work zone below. No workers in immediate area.', 0, 'No injuries', 'Demolition debris management plan not followed', 'Exclusion zone expanded. Debris nets installed.', 'Highway patrol officer', 'under_investigation', false)
    `);

    // 5. Equipment Inspections
    await client.query(`
      CREATE TABLE equipment_inspections (
        id SERIAL PRIMARY KEY,
        equipment_name VARCHAR(255) NOT NULL,
        equipment_type VARCHAR(100) NOT NULL,
        equipment_id VARCHAR(100) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        inspector_name VARCHAR(255) NOT NULL,
        inspection_date DATE NOT NULL,
        next_inspection_date DATE,
        condition VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        hours_used DECIMAL(10,1),
        findings TEXT,
        maintenance_needed TEXT,
        certification_expiry DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO equipment_inspections (equipment_name, equipment_type, equipment_id, site_name, inspector_name, inspection_date, next_inspection_date, condition, status, hours_used, findings, maintenance_needed, certification_expiry) VALUES
      ('Liebherr LTM 1300', 'Tower Crane', 'CR-001', 'Skyline Tower Project', 'Jane Inspector', '2024-03-15', '2024-03-22', 'Good', 'active', 2450.5, 'All systems operational. Minor hydraulic seepage on boom cylinder.', 'Schedule hydraulic seal replacement within 30 days', '2024-09-15'),
      ('CAT 320F Excavator', 'Excavator', 'EX-002', 'Metro Hospital Wing B', 'Mike Chen', '2024-03-14', '2024-03-21', 'Excellent', 'active', 1200.0, 'Track tension correct. Bucket teeth in good condition.', 'None needed at this time', '2024-12-01'),
      ('JLG 860SJ Boom Lift', 'Aerial Lift', 'AL-003', 'Harbor Bridge Renovation', 'Sarah Williams', '2024-03-13', '2024-03-20', 'Fair', 'needs_repair', 3100.0, 'Platform leveling sensor intermittent. Outrigger pad cracked.', 'Replace leveling sensor and outrigger pad', '2024-06-30'),
      ('Potain MCT 88', 'Tower Crane', 'CR-004', 'Oceanview Resort', 'Tom Garcia', '2024-03-12', '2024-03-19', 'Poor', 'out_of_service', 4500.0, 'Certification expired. Load moment indicator needs calibration.', 'Recertification required. LMI calibration.', '2024-02-28'),
      ('Bobcat S770 Skid Steer', 'Skid Steer', 'SS-005', 'Central Park Condos', 'Jane Inspector', '2024-03-11', '2024-03-18', 'Good', 'active', 800.5, 'Tires at 60% life. All safety features functional.', 'Plan tire replacement within 60 days', '2025-03-11'),
      ('Genie Z-62/40 Articulating Boom', 'Aerial Lift', 'AL-006', 'Airport Terminal C', 'Mike Chen', '2024-03-10', '2024-03-17', 'Excellent', 'active', 450.0, 'Recently serviced. All functions tested satisfactory.', 'None needed', '2024-10-15'),
      ('Hilti TE 3000-AVR Breaker', 'Power Tool', 'PT-007', 'Subway Extension Line 3', 'Sarah Williams', '2024-03-09', '2024-04-09', 'Good', 'active', 200.0, 'Anti-vibration system functional. Chisel in good condition.', 'Replace chisel when wear indicators show', '2025-03-09'),
      ('Wacker Neuson DPU 6555', 'Compactor', 'CP-008', 'Mountain View Apartments', 'Tom Garcia', '2024-03-08', '2024-03-15', 'Good', 'active', 650.0, 'Compaction readings within spec. Engine running smoothly.', 'Oil change due at 700 hours', '2025-01-08'),
      ('Atlas Copco XAS 188', 'Air Compressor', 'AC-009', 'Riverside Mall Expansion', 'Jane Inspector', '2024-03-07', '2024-03-14', 'Fair', 'active', 2800.0, 'Air filter at 80% life. Pressure relief valve tested OK.', 'Replace air filter. Check all hose connections.', '2024-07-07'),
      ('Kubota KX080-4', 'Mini Excavator', 'EX-010', 'Community Center Rebuild', 'Mike Chen', '2024-03-06', '2024-03-13', 'Excellent', 'active', 550.0, 'All systems nominal. ROPS verified.', 'None needed', '2025-06-06'),
      ('Lincoln Electric Ranger 330', 'Welder', 'WD-011', 'Waterfront Office Complex', 'Sarah Williams', '2024-03-05', '2024-04-05', 'Good', 'active', 1100.0, 'Arc stable. Cable insulation intact. Electrode holder good.', 'Replace ground cable within 60 days', '2025-03-05'),
      ('Multiquip MQ Power Whisperwatt', 'Generator', 'GN-012', 'Solar Farm Installation', 'Tom Garcia', '2024-03-04', '2024-03-11', 'Good', 'active', 3200.0, 'Output voltage stable. Fuel system clean. Sound levels normal.', 'Coolant flush due at 3500 hours', '2024-08-04'),
      ('Putzmeister BSF 36Z', 'Concrete Pump', 'CP-013', 'Data Center Facility', 'Jane Inspector', '2024-03-03', '2024-03-10', 'Fair', 'needs_repair', 1800.0, 'Hopper agitator sluggish. Pipeline wear indicators near limit.', 'Replace agitator motor and worn pipeline sections', '2024-09-03'),
      ('Trimble S9 Total Station', 'Survey Equipment', 'SE-014', 'Tech Campus Building 4', 'Mike Chen', '2024-03-02', '2024-06-02', 'Excellent', 'active', 300.0, 'Calibration verified. All measurements within tolerance.', 'None needed until next calibration', '2025-03-02'),
      ('Husqvarna K 970 Ring Saw', 'Power Tool', 'PT-015', 'Historic Library Restoration', 'Sarah Williams', '2024-03-01', '2024-04-01', 'Good', 'active', 150.0, 'Water supply system working. Blade at 70% life.', 'Order replacement blade', '2025-03-01'),
      ('Volvo EC950F Excavator', 'Excavator', 'EX-016', 'Interstate Bridge 95', 'Tom Garcia', '2024-02-28', '2024-03-07', 'Good', 'active', 5200.0, 'Undercarriage at 50% life. Hydraulic pressures normal.', 'Plan undercarriage service at next milestone', '2024-11-28')
    `);

    // 6. Worker Certifications
    await client.query(`
      CREATE TABLE worker_certifications (
        id SERIAL PRIMARY KEY,
        worker_name VARCHAR(255) NOT NULL,
        worker_id VARCHAR(50) NOT NULL,
        certification_type VARCHAR(255) NOT NULL,
        certification_number VARCHAR(100),
        issuing_authority VARCHAR(255) NOT NULL,
        issue_date DATE NOT NULL,
        expiry_date DATE NOT NULL,
        site_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO worker_certifications (worker_name, worker_id, certification_type, certification_number, issuing_authority, issue_date, expiry_date, site_name, status, notes) VALUES
      ('Carlos Rivera', 'W-001', 'OSHA 30-Hour Construction', 'OSHA-30-78432', 'OSHA Training Institute', '2023-06-15', '2028-06-15', 'Skyline Tower Project', 'active', 'Completed with distinction'),
      ('Amy Lee', 'W-002', 'Certified Crane Operator (CCO)', 'CCO-2023-1456', 'NCCCO', '2023-01-20', '2028-01-20', 'Skyline Tower Project', 'active', 'Lattice boom and tower crane endorsements'),
      ('Frank Torres', 'W-003', 'Confined Space Entry', 'CSE-8834', 'National Safety Council', '2023-09-10', '2024-09-10', 'Subway Extension Line 3', 'active', 'Includes rescue team certification'),
      ('Lisa Wang', 'W-004', 'Certified Welding Inspector', 'CWI-23-0982', 'American Welding Society', '2022-11-01', '2025-11-01', 'Waterfront Office Complex', 'active', 'D1.1 Structural Steel qualified'),
      ('Greg Patel', 'W-005', 'Asbestos Abatement Supervisor', 'AAS-PA-4521', 'PA DEP', '2023-03-15', '2025-03-15', 'Historic Library Restoration', 'active', 'Class I and II operations'),
      ('Maria Gonzalez', 'W-006', 'First Aid/CPR/AED', 'FA-2024-3321', 'American Red Cross', '2024-01-10', '2026-01-10', 'Solar Farm Installation', 'active', 'Includes wilderness first aid'),
      ('Dave Kim', 'W-007', 'OSHA 10-Hour Construction', 'OSHA-10-99231', 'OSHA Training Institute', '2024-02-01', '2029-02-01', 'Skyline Tower Project', 'active', 'Focus on fall protection'),
      ('Rachel Adams', 'W-008', 'Competent Person - Excavation', 'CP-EX-5567', 'National Utility Contractors Assoc', '2023-07-20', '2025-07-20', 'Metro Hospital Wing B', 'active', 'Soil classification qualified'),
      ('Steve Park', 'W-009', 'Forklift Operator', 'FO-2023-8891', 'OSHA Authorized Trainer', '2023-05-05', '2026-05-05', 'Airport Terminal C', 'active', 'Rough terrain and warehouse'),
      ('Tony Martinez', 'W-010', 'Scaffolding Competent Person', 'SCP-7723', 'Scaffold Industry Association', '2023-08-12', '2025-08-12', 'Harbor Bridge Renovation', 'active', 'Supported and suspended scaffolds'),
      ('Nancy Chen', 'W-011', 'Lead Paint Abatement', 'LPA-MD-2234', 'EPA RRP', '2023-04-18', '2028-04-18', 'Historic Library Restoration', 'active', 'Renovator/firm certification'),
      ('Paul Wright', 'W-012', 'Rigging Specialist', 'RS-2023-4456', 'NCCCO', '2023-02-28', '2028-02-28', 'Riverside Mall Expansion', 'active', 'Signal person qualified'),
      ('Brian Moore', 'W-013', 'Hazardous Waste Operations', 'HAZWOPER-40-1123', 'OSHA', '2023-10-05', '2024-10-05', 'Community Center Rebuild', 'active', '40-hour HAZWOPER with annual refresher due'),
      ('Cindy Park', 'W-014', 'Blasting Certification', 'BLAST-NY-889', 'NY State DOL', '2022-12-01', '2024-12-01', 'Subway Extension Line 3', 'active', 'Underground blasting specialist'),
      ('Alex Turner', 'W-015', 'Structural Steel Erector', 'SSE-2023-5577', 'AISC', '2023-06-30', '2025-06-30', 'Data Center Facility', 'active', 'Bolt-up and connection specialist'),
      ('Kim Lee', 'W-016', 'Fire Watch Certified', 'FW-2024-1001', 'Local Fire Marshal', '2024-01-15', '2025-01-15', 'Data Center Facility', 'active', 'Hot work permit authorized')
    `);

    // 7. Safety Training
    await client.query(`
      CREATE TABLE safety_training (
        id SERIAL PRIMARY KEY,
        training_title VARCHAR(255) NOT NULL,
        training_type VARCHAR(100) NOT NULL,
        instructor VARCHAR(255) NOT NULL,
        site_name VARCHAR(255),
        training_date DATE NOT NULL,
        duration_hours DECIMAL(4,1) NOT NULL,
        attendees_count INTEGER NOT NULL,
        max_capacity INTEGER,
        status VARCHAR(50) DEFAULT 'scheduled',
        description TEXT,
        materials_provided TEXT,
        certification_awarded BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO safety_training (training_title, training_type, instructor, site_name, training_date, duration_hours, attendees_count, max_capacity, status, description, materials_provided, certification_awarded) VALUES
      ('Fall Protection Awareness', 'Safety', 'Jane Inspector', 'Skyline Tower Project', '2024-03-15', 4.0, 25, 30, 'completed', 'Comprehensive fall protection training including harness inspection, anchor points, and rescue procedures.', 'Handouts, harness samples, rescue equipment demo', true),
      ('Hazard Communication (HazCom)', 'Regulatory', 'Mike Chen', 'Solar Farm Installation', '2024-03-14', 2.0, 18, 20, 'completed', 'GHS labeling, SDS interpretation, and chemical handling procedures.', 'SDS binders, GHS quick reference cards', true),
      ('Excavation & Trenching Safety', 'Safety', 'Sarah Williams', 'Metro Hospital Wing B', '2024-03-13', 6.0, 15, 15, 'completed', 'Soil classification, protective systems, and competent person responsibilities.', 'Soil testing kits, reference manual', true),
      ('Crane Signal Person Training', 'Operational', 'Tom Garcia', 'Oceanview Resort', '2024-03-20', 8.0, 10, 12, 'scheduled', 'Standard hand signals, radio communication, and load chart reading.', 'Signal cards, radio equipment', true),
      ('Silica Dust Awareness', 'Health', 'Jane Inspector', 'Community Center Rebuild', '2024-03-12', 3.0, 22, 25, 'completed', 'Respirable crystalline silica exposure limits, controls, and medical surveillance.', 'Dust masks, monitoring badges', false),
      ('Electrical Safety (NFPA 70E)', 'Safety', 'Mike Chen', 'Tech Campus Building 4', '2024-03-11', 8.0, 12, 15, 'completed', 'Arc flash hazard analysis, PPE selection, and lockout/tagout procedures.', 'PPE samples, LOTO tags and locks', true),
      ('Scaffold Erection & Dismantling', 'Operational', 'Sarah Williams', '2024-03-25', '2024-03-25', 6.0, 0, 20, 'scheduled', 'Proper scaffold assembly, inspection criteria, and load capacities.', 'Scaffold components, inspection checklists', true),
      ('Heat Illness Prevention', 'Health', 'Tom Garcia', 'Solar Farm Installation', '2024-03-10', 2.0, 30, 30, 'completed', 'Recognizing heat stress, hydration, acclimatization, and emergency response.', 'Water bottles, cooling towels, reference cards', false),
      ('Confined Space Rescue', 'Emergency', 'Jane Inspector', 'Subway Extension Line 3', '2024-03-09', 8.0, 8, 8, 'completed', 'Entry procedures, atmospheric monitoring, and non-entry rescue techniques.', 'Rescue equipment, gas monitors', true),
      ('Fire Extinguisher Training', 'Safety', 'Mike Chen', 'Riverside Mall Expansion', '2024-03-08', 1.5, 35, 40, 'completed', 'PASS technique, extinguisher types, and when to fight vs. flee.', 'Training extinguishers, fire simulation prop', false),
      ('Asbestos Awareness', 'Health', 'Sarah Williams', 'Historic Library Restoration', '2024-03-07', 4.0, 20, 20, 'completed', 'Identifying ACM, exposure risks, and proper abatement procedures.', 'Sample identification kit, regulatory references', true),
      ('Forklift Operator Refresher', 'Operational', 'Tom Garcia', 'Airport Terminal C', '2024-03-18', 4.0, 8, 10, 'scheduled', 'Operating procedures, load handling, and pre-operation inspection.', 'Operator manual, inspection forms', true),
      ('Bloodborne Pathogens', 'Health', 'Jane Inspector', 'All Sites', '2024-03-06', 2.0, 40, 50, 'completed', 'Exposure control plan, universal precautions, and post-exposure procedures.', 'PPE kits, exposure incident forms', false),
      ('Rigging & Load Securement', 'Operational', 'Mike Chen', 'Waterfront Office Complex', '2024-03-05', 6.0, 14, 15, 'completed', 'Sling inspection, load weight estimation, and critical lift planning.', 'Sling samples, rigging reference cards', true),
      ('Emergency Action Plan', 'Emergency', 'Sarah Williams', 'Data Center Facility', '2024-03-04', 3.0, 28, 30, 'completed', 'Evacuation procedures, assembly points, and emergency contact protocols.', 'Evacuation maps, emergency contact cards', false),
      ('Lead Awareness Training', 'Health', 'Tom Garcia', 'Historic Library Restoration', '2024-03-22', 4.0, 0, 15, 'scheduled', 'Lead exposure risks, blood lead monitoring, and decontamination procedures.', 'PPE samples, monitoring procedures', true)
    `);

    // 8. Hazard Assessments
    await client.query(`
      CREATE TABLE hazard_assessments (
        id SERIAL PRIMARY KEY,
        hazard_title VARCHAR(255) NOT NULL,
        hazard_type VARCHAR(100) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        location_detail VARCHAR(255),
        risk_level VARCHAR(50) NOT NULL,
        probability VARCHAR(50) NOT NULL,
        impact VARCHAR(50) NOT NULL,
        assessed_by VARCHAR(255) NOT NULL,
        assessment_date DATE NOT NULL,
        description TEXT NOT NULL,
        control_measures TEXT,
        residual_risk VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        review_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO hazard_assessments (hazard_title, hazard_type, site_name, location_detail, risk_level, probability, impact, assessed_by, assessment_date, description, control_measures, residual_risk, status, review_date) VALUES
      ('Working at Heights - Steel Erection', 'Fall', 'Skyline Tower Project', 'Floors 10-20', 'extreme', 'likely', 'catastrophic', 'Jane Inspector', '2024-03-15', 'Workers performing steel erection at heights up to 200 feet with exposure to unprotected edges.', 'Personal fall arrest systems, safety nets, controlled access zones, daily briefings', 'medium', 'active', '2024-04-15'),
      ('Underground Gas Line Proximity', 'Utility Strike', 'Metro Hospital Wing B', 'East Excavation Zone', 'high', 'possible', 'major', 'Mike Chen', '2024-03-14', 'Active gas main within 5 feet of planned excavation path.', 'Hand digging within 3 feet of marked utility, gas detection monitors, utility company standby', 'low', 'active', '2024-03-28'),
      ('Lead Paint Exposure', 'Chemical', 'Historic Library Restoration', 'All Interior Areas', 'high', 'likely', 'major', 'Sarah Williams', '2024-03-13', 'Original 1920s paint confirmed to contain lead at levels up to 12% by weight.', 'Full containment, HEPA ventilation, P100 respirators, blood lead monitoring, decontamination', 'low', 'active', '2024-04-13'),
      ('Crane Operations Near Power Lines', 'Electrical', 'Oceanview Resort', 'North Construction Zone', 'extreme', 'possible', 'catastrophic', 'Tom Garcia', '2024-03-12', '69kV transmission line runs within 50 feet of crane operating radius.', 'Dedicated spotter, range limiter installed, minimum 20ft clearance maintained, power company notification', 'medium', 'active', '2024-03-26'),
      ('Silica Dust from Concrete Cutting', 'Health', 'Community Center Rebuild', 'Foundation Area', 'high', 'likely', 'major', 'Jane Inspector', '2024-03-11', 'Concrete cutting and grinding operations generating respirable crystalline silica above PEL.', 'Wet cutting methods, local exhaust ventilation, respiratory protection program, exposure monitoring', 'low', 'active', '2024-04-11'),
      ('Confined Space - Storm Drain', 'Confined Space', 'Subway Extension Line 3', 'Tunnel Access Points 1-5', 'extreme', 'likely', 'catastrophic', 'Mike Chen', '2024-03-10', 'Multiple confined spaces with potential for oxygen deficiency, toxic gas, and engulfment.', 'Permit-required entry, continuous air monitoring, rescue team standby, ventilation', 'medium', 'active', '2024-03-24'),
      ('Extreme Heat Exposure', 'Environmental', 'Solar Farm Installation', 'All Work Areas', 'high', 'almost_certain', 'major', 'Sarah Williams', '2024-03-09', 'Ambient temperatures regularly exceeding 100°F with limited shade in open desert.', 'Acclimatization schedule, mandatory rest breaks, hydration stations, buddy system, cooling vests', 'medium', 'active', '2024-04-09'),
      ('Vehicle-Pedestrian Interaction', 'Traffic', 'Airport Terminal C', 'Access Roads and Apron', 'high', 'possible', 'major', 'Tom Garcia', '2024-03-08', 'Heavy equipment and delivery vehicles sharing routes with construction workers on foot.', 'Designated walkways, high-visibility vests, vehicle speed limits, spotters for backing', 'low', 'active', '2024-04-08'),
      ('Structural Instability During Demo', 'Structural', 'Community Center Rebuild', 'Building A Demolition Zone', 'extreme', 'possible', 'catastrophic', 'Jane Inspector', '2024-03-07', 'Partial demolition may compromise structural integrity of remaining connected structures.', 'Engineering survey before each phase, exclusion zones, monitoring points, progressive demolition plan', 'medium', 'active', '2024-03-21'),
      ('Noise Exposure - Pile Driving', 'Health', 'Waterfront Office Complex', 'Foundation Area', 'medium', 'almost_certain', 'moderate', 'Mike Chen', '2024-03-06', 'Impact pile driving generating noise levels of 110dB at 50 feet.', 'Dual hearing protection, noise monitoring, rotation of exposed workers, barrier walls', 'low', 'active', '2024-04-06'),
      ('Falling Objects from Overhead Work', 'Struck-By', 'Skyline Tower Project', 'Ground Level All Areas', 'high', 'likely', 'major', 'Sarah Williams', '2024-03-05', 'Multiple trades working simultaneously on upper floors with risk of dropped tools and materials.', 'Overhead protection canopies, tool tethering, barricaded drop zones, debris nets', 'medium', 'active', '2024-03-19'),
      ('Chemical Storage Compatibility', 'Chemical', 'Data Center Facility', 'Chemical Storage Room', 'medium', 'unlikely', 'major', 'Tom Garcia', '2024-03-04', 'Various cleaning chemicals and construction adhesives stored in same area.', 'Segregated storage by compatibility class, ventilation, spill containment, SDS posting', 'low', 'active', '2024-04-04'),
      ('Excavation Cave-In Risk', 'Cave-In', 'Mountain View Apartments', 'Hillside Cut Section', 'extreme', 'likely', 'catastrophic', 'Jane Inspector', '2024-03-03', 'Steep slope cut into hillside with unstable soil and groundwater seepage.', 'Engineered shoring system, dewatering, slope monitoring, daily inspections, benching', 'medium', 'active', '2024-03-17'),
      ('Welding Fume Exposure', 'Health', 'Waterfront Office Complex', 'Steel Frame Levels 1-4', 'medium', 'likely', 'moderate', 'Mike Chen', '2024-03-02', 'Structural welding generating manganese and hexavalent chromium fumes.', 'Local exhaust ventilation, supplied air respirators, exposure monitoring, medical surveillance', 'low', 'active', '2024-04-02'),
      ('Lightning Strike Risk', 'Environmental', 'Solar Farm Installation', 'Open Array Fields', 'high', 'possible', 'catastrophic', 'Sarah Williams', '2024-03-01', 'Workers exposed in open field with metal structures during monsoon season.', 'Lightning detection system, 30-30 rule evacuation policy, grounding of structures, shelter locations', 'medium', 'active', '2024-04-01'),
      ('Biological Hazards - Mold', 'Biological', 'Historic Library Restoration', 'Basement and Sub-Basement', 'medium', 'likely', 'moderate', 'Tom Garcia', '2024-02-28', 'Extensive mold growth found on walls and HVAC ducts in basement levels.', 'Professional remediation, N95 minimum respiratory protection, containment barriers, HEPA filtration', 'low', 'active', '2024-03-28')
    `);

    // 9. Compliance Documents
    await client.query(`
      CREATE TABLE compliance_documents (
        id SERIAL PRIMARY KEY,
        document_title VARCHAR(255) NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        regulatory_body VARCHAR(255) NOT NULL,
        issue_date DATE,
        expiry_date DATE,
        status VARCHAR(50) DEFAULT 'active',
        responsible_person VARCHAR(255),
        document_number VARCHAR(100),
        description TEXT,
        renewal_required BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO compliance_documents (document_title, document_type, site_name, regulatory_body, issue_date, expiry_date, status, responsible_person, document_number, description, renewal_required) VALUES
      ('Building Permit', 'Permit', 'Skyline Tower Project', 'NYC Department of Buildings', '2023-06-01', '2025-06-01', 'active', 'John Administrator', 'BP-2023-45678', 'General building permit for 25-story mixed-use tower construction', true),
      ('Environmental Impact Assessment', 'Assessment', 'Metro Hospital Wing B', 'Illinois EPA', '2023-08-15', '2025-08-15', 'active', 'Sarah Williams', 'EIA-IL-2023-891', 'Environmental assessment covering soil, water, and air impact during construction', false),
      ('Crane Operating Permit', 'Permit', 'Oceanview Resort', 'FL OSHA', '2023-02-28', '2024-02-28', 'expired', 'Tom Garcia', 'COP-FL-2023-234', 'Tower crane operating permit - EXPIRED - requires renewal', true),
      ('Stormwater Pollution Prevention Plan', 'Plan', 'Mountain View Apartments', 'WA Dept of Ecology', '2023-09-01', '2025-09-01', 'active', 'Mike Chen', 'SWPPP-WA-4456', 'NPDES permit compliance plan for stormwater management during construction', true),
      ('Demolition Permit', 'Permit', 'Community Center Rebuild', 'City of Atlanta', '2023-11-01', '2024-05-01', 'active', 'Jane Inspector', 'DP-ATL-2023-567', 'Permit for controlled demolition of existing community center structure', true),
      ('Lead Paint Abatement License', 'License', 'Historic Library Restoration', 'PA DEP', '2023-04-15', '2025-04-15', 'active', 'Greg Patel', 'LPA-PA-2023-112', 'State license for lead paint removal and abatement activities', true),
      ('OSHA Silica Exposure Control Plan', 'Plan', 'Community Center Rebuild', 'OSHA', '2024-01-10', '2025-01-10', 'active', 'Jane Inspector', 'SECP-2024-001', 'Written exposure control plan per OSHA Table 1 for silica generating tasks', true),
      ('Fire Safety Certificate', 'Certificate', 'Riverside Mall Expansion', 'Houston Fire Department', '2024-02-01', '2025-02-01', 'active', 'Tom Garcia', 'FSC-HOU-2024-789', 'Fire prevention and protection compliance certificate for active construction site', true),
      ('Blasting Permit', 'Permit', 'Subway Extension Line 3', 'NYC Fire Department', '2023-10-01', '2024-10-01', 'active', 'Cindy Park', 'BP-FDNY-2023-345', 'Controlled blasting permit for tunnel excavation in rock', true),
      ('Asbestos Abatement Notification', 'Notification', 'Historic Library Restoration', 'EPA Region 3', '2024-01-05', '2024-07-05', 'active', 'Sarah Williams', 'AAN-EPA3-2024-056', 'NESHAP notification for asbestos removal exceeding threshold quantities', false),
      ('Traffic Control Permit', 'Permit', 'Interstate Bridge 95', 'MD State Highway Admin', '2024-01-15', '2024-07-15', 'active', 'Mike Chen', 'TCP-MDSHA-2024-123', 'Lane closure and traffic control permit for bridge rehabilitation work', true),
      ('Noise Variance Permit', 'Permit', 'Skyline Tower Project', 'NYC DEP', '2024-02-15', '2024-08-15', 'active', 'Jane Inspector', 'NVP-DEP-2024-234', 'After-hours construction noise variance for concrete pours', true),
      ('Hazardous Waste Generator License', 'License', 'Data Center Facility', 'TX Commission on Environmental Quality', '2023-12-01', '2024-12-01', 'active', 'Tom Garcia', 'HWG-TCEQ-2023-456', 'Small quantity generator license for construction waste including solvents', true),
      ('Elevator Installation Permit', 'Permit', 'Airport Terminal C', 'CO Dept of Labor', '2024-03-01', '2025-03-01', 'active', 'Sarah Williams', 'EIP-CO-2024-789', 'Permit for installation of 6 passenger elevators and 2 freight elevators', true),
      ('Occupancy Variance', 'Variance', 'Tech Campus Building 4', 'City of Austin', '2024-02-20', '2025-02-20', 'active', 'Mike Chen', 'OV-AUS-2024-112', 'Temporary certificate allowing phased occupancy during construction', true),
      ('Underground Storage Tank Permit', 'Permit', 'Airport Terminal C', 'CO DPHE', '2023-07-01', '2025-07-01', 'active', 'Tom Garcia', 'UST-CO-2023-567', 'Permit for installation and monitoring of fuel storage tanks', true)
    `);

    // 10. Emergency Plans
    await client.query(`
      CREATE TABLE emergency_plans (
        id SERIAL PRIMARY KEY,
        plan_title VARCHAR(255) NOT NULL,
        plan_type VARCHAR(100) NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        emergency_coordinator VARCHAR(255) NOT NULL,
        coordinator_phone VARCHAR(50),
        last_drill_date DATE,
        next_drill_date DATE,
        status VARCHAR(50) DEFAULT 'active',
        description TEXT,
        evacuation_routes TEXT,
        assembly_points TEXT,
        emergency_contacts TEXT,
        last_updated DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO emergency_plans (plan_title, plan_type, site_name, emergency_coordinator, coordinator_phone, last_drill_date, next_drill_date, status, description, evacuation_routes, assembly_points, emergency_contacts, last_updated) VALUES
      ('Fire Emergency Response Plan', 'Fire', 'Skyline Tower Project', 'Jane Inspector', '555-0101', '2024-03-01', '2024-04-01', 'active', 'Comprehensive fire response plan including suppression, evacuation, and accountability procedures for high-rise construction.', 'Stairwell A (primary), Stairwell B (secondary), Construction hoist (non-fire emergencies)', 'Lot A North Corner, Lot B Main Gate', 'Fire Dept: 911, Site Safety: 555-0101, Project Manager: 555-0102', '2024-03-01'),
      ('Medical Emergency Plan', 'Medical', 'All Sites', 'Sarah Williams', '555-0103', '2024-02-15', '2024-03-15', 'active', 'Standard medical emergency response procedures including first aid, AED locations, and hospital routes.', 'Nearest clear path to site entrance for ambulance access', 'Main site entrance, designated helicopter landing zone if needed', 'EMS: 911, Site Medic: 555-0104, Occupational Health Clinic: 555-0105', '2024-02-15'),
      ('Severe Weather Action Plan', 'Weather', 'Solar Farm Installation', 'Tom Garcia', '555-0106', '2024-02-28', '2024-05-28', 'active', 'Lightning, high wind, and extreme heat emergency procedures for open desert construction.', 'Metal buildings on east perimeter (primary), vehicles (secondary)', 'Equipment storage building, office trailers', 'NWS Weather Radio, Site Safety: 555-0106, Corporate Safety: 555-0107', '2024-02-28'),
      ('Crane Emergency Plan', 'Equipment', 'Oceanview Resort', 'Mike Chen', '555-0108', '2024-01-20', '2024-04-20', 'needs_update', 'Emergency procedures for crane malfunction, overload, and structural failure scenarios.', 'Swing radius exclusion zone evacuation outward from crane base', 'South parking lot beyond swing radius', 'Crane Company: 555-0109, OSHA: 555-0110, Site Safety: 555-0108', '2024-01-20'),
      ('Hazardous Material Spill Plan', 'HazMat', 'Historic Library Restoration', 'Sarah Williams', '555-0111', '2024-02-10', '2024-05-10', 'active', 'Lead and asbestos containment breach response, chemical spill procedures, and decontamination protocols.', 'Upwind exit routes, avoid contaminated zones marked with red flags', 'Clean zone assembly area - west parking lot', 'HazMat Team: 555-0112, EPA Hotline: 555-0113, Poison Control: 555-0114', '2024-02-10'),
      ('Tunnel Rescue Plan', 'Rescue', 'Subway Extension Line 3', 'Mike Chen', '555-0115', '2024-03-05', '2024-04-05', 'active', 'Underground rescue procedures including cave-in, gas exposure, and flooding emergency response.', 'Tunnel access shafts A through E, emergency escape routes marked with reflective tape', 'Surface assembly area at each shaft entrance', 'Mine Rescue: 555-0116, Fire Dept Rescue: 911, Site Safety: 555-0115', '2024-03-05'),
      ('Earthquake Response Plan', 'Natural Disaster', 'Harbor Bridge Renovation', 'Jane Inspector', '555-0117', '2024-01-15', '2024-07-15', 'active', 'Seismic event response procedures for bridge construction workers including structural assessment protocol.', 'Move to solid ground away from bridge structure, avoid overhead and water hazards', 'Shore-side parking area east, emergency boat pickup west pier', 'USGS: 555-0118, Structural Engineer: 555-0119, Coast Guard: 555-0120', '2024-01-15'),
      ('Flood Response Plan', 'Natural Disaster', 'Waterfront Office Complex', 'Tom Garcia', '555-0121', '2024-02-20', '2024-08-20', 'active', 'Waterfront flooding and storm surge emergency procedures including equipment protection.', 'Uphill routes to Highland Ave, avoid basement and dock areas', 'Highland Ave parking structure Level 3', 'Port Authority: 555-0122, NWS: 555-0123, Site Safety: 555-0121', '2024-02-20'),
      ('Power Outage Emergency Plan', 'Utility', 'Data Center Facility', 'Sarah Williams', '555-0124', '2024-03-10', '2024-06-10', 'active', 'Emergency procedures for complete power loss including backup generator activation and safe shutdown.', 'Standard exit routes with emergency lighting, follow illuminated floor strips', 'Main lobby, exterior assembly area Lot C', 'Utility Company: 555-0125, Generator Service: 555-0126, Site Safety: 555-0124', '2024-03-10'),
      ('Excavation Rescue Plan', 'Rescue', 'Metro Hospital Wing B', 'Mike Chen', '555-0127', '2024-02-25', '2024-03-25', 'active', 'Trench rescue procedures including shoring reinforcement, patient packaging, and extraction.', 'Move away from trench edges perpendicular to trench line', 'Equipment staging area 100ft from trench', 'Fire Dept Rescue: 911, Trench Rescue Team: 555-0128, Site Safety: 555-0127', '2024-02-25'),
      ('Active Shooter Response Plan', 'Security', 'Airport Terminal C', 'Tom Garcia', '555-0129', '2024-01-30', '2024-04-30', 'active', 'Run-Hide-Fight protocol adapted for active construction site at airport facility.', 'Multiple exit points at fence openings, avoid terminal building', 'Airport police substation, remote lot D', 'Airport Police: 555-0130, TSA: 555-0131, 911', '2024-01-30'),
      ('Chemical Exposure Plan', 'Health', 'Tech Campus Building 4', 'Jane Inspector', '555-0132', '2024-03-08', '2024-06-08', 'active', 'Chemical exposure emergency response including decontamination and medical treatment procedures.', 'Move upwind from exposure area, use nearest emergency shower/eyewash', 'Upwind assembly at main parking lot', 'Poison Control: 1-800-222-1222, Site Medic: 555-0133, Safety: 555-0132', '2024-03-08'),
      ('Traffic Incident Plan', 'Traffic', 'Interstate Bridge 95', 'Sarah Williams', '555-0134', '2024-02-05', '2024-05-05', 'active', 'Vehicle intrusion and traffic incident response in highway work zone.', 'Move behind concrete barriers, away from travel lanes', 'Maintenance yard behind barrier wall', 'Highway Patrol: 555-0135, DOT TMC: 555-0136, Site Safety: 555-0134', '2024-02-05'),
      ('Structural Collapse Plan', 'Structural', 'Community Center Rebuild', 'Mike Chen', '555-0137', '2024-02-18', '2024-05-18', 'active', 'Partial structural collapse emergency response during demolition operations.', 'Move away from structure in all directions minimum 1.5x building height', 'Far lot beyond collapse exclusion zone', 'USAR Team: 555-0138, Structural Engineer: 555-0139, Site Safety: 555-0137', '2024-02-18'),
      ('Heat Illness Emergency Plan', 'Health', 'Solar Farm Installation', 'Tom Garcia', '555-0140', '2024-03-12', '2024-04-12', 'active', 'Heat stroke and heat exhaustion emergency response including cooling procedures and medical transport.', 'Move to nearest shade structure or air-conditioned vehicle', 'Medical trailer with AC, equipment building', 'EMS: 911, Site Medic: 555-0141, Safety: 555-0140', '2024-03-12'),
      ('Electrical Emergency Plan', 'Electrical', 'Riverside Mall Expansion', 'Jane Inspector', '555-0142', '2024-03-02', '2024-06-02', 'active', 'Electrical contact, arc flash, and electrocution emergency response procedures.', 'Move away from energized equipment, do not touch victim until power secured', 'Main gate assembly area', 'Utility Emergency: 555-0143, EMS: 911, Site Electrician: 555-0144', '2024-03-02')
    `);

    // 11. PPE Inventory
    await client.query(`
      CREATE TABLE ppe_inventory (
        id SERIAL PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        ppe_type VARCHAR(100) NOT NULL,
        manufacturer VARCHAR(255),
        model VARCHAR(255),
        site_name VARCHAR(255) NOT NULL,
        quantity_in_stock INTEGER NOT NULL,
        minimum_stock INTEGER NOT NULL,
        unit_cost DECIMAL(10,2),
        condition VARCHAR(50) DEFAULT 'good',
        last_inspection_date DATE,
        expiry_date DATE,
        storage_location VARCHAR(255),
        status VARCHAR(50) DEFAULT 'in_stock',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO ppe_inventory (item_name, category, ppe_type, manufacturer, model, site_name, quantity_in_stock, minimum_stock, unit_cost, condition, last_inspection_date, expiry_date, storage_location, status) VALUES
      ('Hard Hat - Class E', 'Head Protection', 'Hard Hat', 'MSA', 'V-Gard 500', 'Skyline Tower Project', 150, 50, 28.99, 'good', '2024-03-15', '2029-03-15', 'Safety Trailer A - Shelf 1', 'in_stock'),
      ('Safety Glasses - Anti-Fog', 'Eye Protection', 'Safety Glasses', '3M', 'SecureFit 400', 'All Sites', 500, 200, 8.50, 'good', '2024-03-15', '2026-03-15', 'Central Warehouse - Bin 12', 'in_stock'),
      ('Fall Protection Harness', 'Fall Protection', 'Full Body Harness', 'Miller', 'Revolution R3', 'Harbor Bridge Renovation', 45, 20, 189.00, 'good', '2024-03-14', '2029-03-14', 'Safety Trailer B - Rack 3', 'in_stock'),
      ('P100 Half-Face Respirator', 'Respiratory', 'Respirator', '3M', '6300 Series', 'Historic Library Restoration', 30, 15, 32.00, 'good', '2024-03-13', '2025-03-13', 'HazMat Trailer - Cabinet 2', 'in_stock'),
      ('Steel Toe Boots - Size Assorted', 'Foot Protection', 'Safety Boots', 'Timberland PRO', 'Pit Boss', 'All Sites', 80, 30, 115.00, 'good', '2024-03-12', null, 'Central Warehouse - Shelf 5', 'in_stock'),
      ('High-Visibility Vest - Class 3', 'Visibility', 'Hi-Vis Vest', 'Ergodyne', 'GloWear 8310HL', 'Interstate Bridge 95', 200, 75, 14.99, 'good', '2024-03-11', null, 'Safety Trailer - Bin 8', 'in_stock'),
      ('Welding Helmet - Auto-Darkening', 'Face Protection', 'Welding Helmet', 'Lincoln Electric', 'Viking 3350', 'Waterfront Office Complex', 12, 5, 275.00, 'good', '2024-03-10', null, 'Welding Shop - Wall Rack', 'in_stock'),
      ('Cut-Resistant Gloves - Level A4', 'Hand Protection', 'Gloves', 'HexArmor', 'Helix 2082', 'Riverside Mall Expansion', 300, 100, 18.50, 'good', '2024-03-09', null, 'Safety Trailer C - Bin 3', 'in_stock'),
      ('Earplugs - NRR 33', 'Hearing Protection', 'Earplugs', '3M', 'E-A-R Classic', 'Subway Extension Line 3', 1000, 500, 0.35, 'good', '2024-03-08', '2026-03-08', 'All Safety Stations', 'in_stock'),
      ('Earmuffs - NRR 30', 'Hearing Protection', 'Earmuffs', 'Howard Leight', 'Leightning L3', 'Subway Extension Line 3', 40, 15, 24.99, 'good', '2024-03-08', null, 'Safety Trailer - Shelf 4', 'in_stock'),
      ('Supplied Air Respirator', 'Respiratory', 'SAR System', 'Honeywell', 'Survivair Panther', 'Subway Extension Line 3', 8, 4, 850.00, 'good', '2024-03-07', '2025-09-07', 'Confined Space Equipment Trailer', 'in_stock'),
      ('Knee Pads - Professional', 'Body Protection', 'Knee Pads', 'ProKnee', 'Model 0714', 'Tech Campus Building 4', 50, 20, 42.00, 'good', '2024-03-06', null, 'Safety Trailer - Bin 15', 'in_stock'),
      ('Face Shield - Anti-Fog', 'Face Protection', 'Face Shield', 'MSA', 'V-Gard Frame', 'Data Center Facility', 25, 10, 15.00, 'good', '2024-03-05', null, 'Safety Trailer - Shelf 2', 'in_stock'),
      ('Cooling Vest - Phase Change', 'Body Protection', 'Cooling Vest', 'Ergodyne', 'Chill-Its 6215', 'Solar Farm Installation', 35, 15, 89.99, 'fair', '2024-03-04', null, 'Cooling Station - Rack 1', 'low_stock'),
      ('Disposable Coveralls - Tyvek', 'Body Protection', 'Coveralls', 'DuPont', 'Tyvek 400', 'Historic Library Restoration', 15, 50, 8.75, 'good', '2024-03-03', '2025-12-03', 'HazMat Trailer - Shelf 3', 'low_stock'),
      ('Self-Retracting Lifeline 30ft', 'Fall Protection', 'SRL', 'DBI-SALA', 'Nano-Lok Edge', 'Skyline Tower Project', 20, 10, 425.00, 'good', '2024-03-02', '2029-03-02', 'Safety Trailer A - Rack 5', 'in_stock')
    `);

    // 12. Corrective Actions
    await client.query(`
      CREATE TABLE corrective_actions (
        id SERIAL PRIMARY KEY,
        action_title VARCHAR(255) NOT NULL,
        related_violation VARCHAR(100),
        related_incident VARCHAR(100),
        site_name VARCHAR(255) NOT NULL,
        assigned_to VARCHAR(255) NOT NULL,
        priority VARCHAR(50) NOT NULL,
        due_date DATE NOT NULL,
        completion_date DATE,
        status VARCHAR(50) DEFAULT 'open',
        description TEXT NOT NULL,
        root_cause TEXT,
        corrective_steps TEXT,
        preventive_measures TEXT,
        verification_method TEXT,
        verified_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO corrective_actions (action_title, related_violation, related_incident, site_name, assigned_to, priority, due_date, completion_date, status, description, root_cause, corrective_steps, preventive_measures, verification_method, verified_by) VALUES
      ('Install Fall Protection Guardrails', 'OSHA-1926.501', 'INC-2024-001', 'Harbor Bridge Renovation', 'Mike Chen', 'critical', '2024-03-15', null, 'in_progress', 'Install guardrails at all unprotected edges on east platform levels 3-5.', 'Guardrails removed during material delivery and not reinstalled', '1. Order guardrail components. 2. Install on levels 3-5. 3. Inspect all other locations.', 'Daily guardrail inspection checklist. Guardrail removal permit process.', 'Physical inspection by safety manager', null),
      ('Scaffold Plank Replacement', 'OSHA-1926.451', null, 'Skyline Tower Project', 'Jane Inspector', 'high', '2024-03-20', null, 'in_progress', 'Replace all scaffold planks with gaps exceeding 1 inch on Floor 12.', 'Normal wear and shifting due to wind loads', '1. Remove deficient planks. 2. Install new OSHA-compliant planks. 3. Secure with cleats.', 'Weekly scaffold inspection program enhancement.', 'Scaffold competent person sign-off', null),
      ('Crane Recertification', 'OSHA-1926.54', 'INC-2024-003', 'Oceanview Resort', 'Tom Garcia', 'critical', '2024-03-14', null, 'open', 'Arrange third-party crane recertification and operator recertification.', 'Certification tracking system failed to alert before expiry', '1. Contact certified crane inspector. 2. Schedule inspection. 3. Recertify operator.', 'Implement 60-day advance certification expiry alerts.', 'Third-party certification documentation', null),
      ('Trench Shoring Installation', 'OSHA-1926.651', 'INC-2024-004', 'Metro Hospital Wing B', 'Sarah Williams', 'critical', '2024-03-11', '2024-03-11', 'completed', 'Install proper trench boxes for all excavations deeper than 5 feet.', 'Shoring not extended to match deepened trench', '1. Measured trench depth. 2. Extended trench box. 3. Compacted spoil pile away from edge.', 'Competent person must verify shoring before each shift.', 'Daily trench inspection documentation', 'Mike Chen'),
      ('LOTO Procedure Implementation', 'OSHA-1910.147', null, 'Tech Campus Building 4', 'Jane Inspector', 'high', '2024-03-16', null, 'in_progress', 'Develop and implement comprehensive LOTO program for all electrical work.', 'No formal LOTO procedure existed for the site', '1. Write LOTO procedures. 2. Train all electrical workers. 3. Provide locks and tags.', 'Annual LOTO procedure audit. New worker orientation includes LOTO.', 'Observation audit of three LOTO events', null),
      ('PPE Enforcement Program', 'OSHA-1926.95', null, 'Airport Terminal C', 'Tom Garcia', 'medium', '2024-03-12', '2024-03-12', 'completed', 'Implement strict PPE enforcement with progressive discipline.', 'Inconsistent enforcement of existing PPE policy', '1. Revised PPE policy. 2. Retrained all workers. 3. Posted PPE zones signage.', 'Random PPE compliance audits twice weekly.', 'Audit results review', 'Sarah Williams'),
      ('Flammable Storage Relocation', 'OSHA-1926.152', null, 'Community Center Rebuild', 'Sarah Williams', 'high', '2024-03-10', null, 'in_progress', 'Move all flammable liquids to approved flammable storage cabinet.', 'Storage cabinet was full; overflow stored improperly', '1. Procure additional storage cabinet. 2. Relocate all flammable materials. 3. Update SDS.', 'Weekly flammable storage inspection. Quantity limits enforced.', 'Fire marshal inspection', null),
      ('Traffic Control Plan Revision', 'OSHA-1926.200', null, 'Interstate Bridge 95', 'Mike Chen', 'high', '2024-03-12', null, 'open', 'Revise traffic control plan to meet MUTCD standards and add lighting.', 'Original TCP did not account for lane shift changes', '1. Hire traffic engineer. 2. Redesign TCP. 3. Install new signage and light towers.', 'Monthly TCP review with highway authority.', 'Highway authority approval', null),
      ('Silica Exposure Monitoring', null, 'INC-2024-009', 'Community Center Rebuild', 'Jane Inspector', 'high', '2024-03-08', '2024-03-08', 'completed', 'Implement silica exposure monitoring and wet cutting protocols.', 'Water suppression not used during concrete cutting', '1. Set up water suppression. 2. Provide respirators. 3. Begin exposure monitoring.', 'Engineering controls required for all concrete cutting. Pre-task planning.', 'Air sampling results below PEL', 'Tom Garcia'),
      ('Machine Guard Replacement', null, 'INC-2024-010', 'Riverside Mall Expansion', 'Tom Garcia', 'critical', '2024-03-05', '2024-03-05', 'completed', 'Replace machine guard on conveyor belt and implement guard removal permit.', 'Guard removed for maintenance and not replaced', '1. Installed new guard with quick-release mechanism. 2. Created guard removal permit.', 'Maintenance checklist requires guard verification. Monthly guard audits.', 'Equipment inspection by manufacturer rep', 'Jane Inspector'),
      ('Scaffold Load Capacity Signage', null, 'INC-2024-011', 'Waterfront Office Complex', 'Sarah Williams', 'high', '2024-03-05', '2024-03-05', 'completed', 'Install load capacity signs on all scaffold platforms.', 'Workers unaware of load limits', '1. Calculated load capacity for each section. 2. Installed signs. 3. Retrained workers.', 'Load capacity included in toolbox talks. Signs inspected weekly.', 'Scaffold inspection records', 'Mike Chen'),
      ('Hot Work Permit Enhancement', null, 'INC-2024-012', 'Data Center Facility', 'Mike Chen', 'medium', '2024-03-09', null, 'in_progress', 'Enhance hot work permit process to include combustible clearance verification.', 'Fire watch did not verify clearance of combustibles', '1. Revised hot work permit form. 2. Added combustible survey step. 3. Retrained fire watch.', 'Pre-hot-work photos required. Fire watch extended to 60 minutes post-work.', 'Permit audit by safety manager', null),
      ('Hearing Conservation Program Update', null, 'INC-2024-013', 'Subway Extension Line 3', 'Jane Inspector', 'medium', '2024-03-08', '2024-03-08', 'completed', 'Update hearing conservation program to require dual protection above 95dB.', 'Single protection insufficient for noise levels', '1. Updated program. 2. Provided earmuffs. 3. Scheduled audiometric testing.', 'Dual protection mandatory in posted high-noise areas.', 'Noise monitoring results and audiometric reports', 'Sarah Williams'),
      ('Utility Location Protocol', null, 'INC-2024-015', 'Central Park Condos', 'Tom Garcia', 'high', '2024-03-07', '2024-03-07', 'completed', 'Implement mandatory utility location and hand-digging protocol.', 'Utility markings incomplete; mechanical digging too close to utilities', '1. Re-marked all utilities. 2. Created 3ft hand-dig zone. 3. Utility company on standby.', 'Pre-excavation utility briefing. Utility locate refresher every 30 days.', 'Excavation permit includes utility clearance sign-off', 'Mike Chen'),
      ('Debris Management Plan', null, 'INC-2024-016', 'Interstate Bridge 95', 'Sarah Williams', 'medium', '2024-03-06', null, 'in_progress', 'Develop comprehensive debris management plan for bridge demolition work.', 'Demolition debris not properly contained on bridge deck', '1. Install debris nets. 2. Expand exclusion zones. 3. Assign debris monitor.', 'Daily debris management briefing. Continuous monitoring during demolition.', 'Photographic documentation of containment', null),
      ('Emergency Ladder Installation', 'OSHA-1926.1053', null, 'Skyline Tower Project', 'Mike Chen', 'medium', '2024-03-25', null, 'open', 'Install permanent access ladders at all emergency exit points above floor 10.', 'Temporary ladders not meeting OSHA requirements for emergency egress', '1. Design permanent ladder system. 2. Fabricate and install. 3. Test and certify.', 'Monthly ladder inspection schedule. Include in emergency evacuation drills.', 'Structural engineer certification and load test', null)
    `);

    // 13. AI Analyses
    await client.query(`
      CREATE TABLE ai_analyses (
        id SERIAL PRIMARY KEY,
        analysis_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        site_name VARCHAR(255),
        input_data TEXT,
        ai_response TEXT,
        model_used VARCHAR(100),
        status VARCHAR(50) DEFAULT 'completed',
        requested_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO ai_analyses (analysis_type, title, site_name, input_data, ai_response, model_used, status, requested_by) VALUES
      ('risk_assessment', 'Fall Hazard Risk Analysis', 'Skyline Tower Project', 'High-rise construction, 25 floors, steel erection ongoing', 'Risk Level: HIGH. Key concerns: 1) Unprotected edges above 6ft require immediate fall protection. 2) Steel erection crew needs 100% tie-off policy. Recommendation: Install retractable lifelines at all perimeter columns.', 'claude-haiku-4.5', 'completed', 'Jane Inspector'),
      ('compliance_check', 'OSHA Compliance Gap Analysis', 'Harbor Bridge Renovation', 'Bridge renovation with overwater work, scaffolding, crane operations', 'Compliance Gaps Found: 3 critical, 5 major. Critical: Fall protection over water, crane proximity to power lines, scaffold inspection frequency. Estimated fine exposure: $485,000.', 'claude-haiku-4.5', 'completed', 'Mike Chen'),
      ('incident_prediction', 'Predictive Safety Analysis Q2', 'All Sites', 'Historical incident data from 16 active sites over 6 months', 'Prediction: 73% probability of struck-by incident at Skyline Tower within 30 days based on near-miss trends. Recommend: Tool tethering enforcement, overhead protection expansion.', 'claude-haiku-4.5', 'completed', 'Sarah Williams'),
      ('training_recommendation', 'Training Gap Analysis', 'Solar Farm Installation', '85 workers, desert environment, electrical work, heat exposure', 'Training Gaps: 1) Only 60% have heat illness prevention training. 2) Electrical safety training needed for 12 new hires. 3) Emergency response drill overdue. Priority: Heat illness prevention before summer peak.', 'claude-haiku-4.5', 'completed', 'Tom Garcia'),
      ('inspection_summary', 'Monthly Inspection Summary', 'Metro Hospital Wing B', 'March inspections: excavation, utilities, structural', 'Summary: 12 inspections completed. 3 violations found and corrected. Key improvement: Trench safety compliance increased from 75% to 98% after corrective actions. Area of concern: Utility marking accuracy needs improvement.', 'claude-haiku-4.5', 'completed', 'Jane Inspector'),
      ('hazard_identification', 'AI Hazard Scan - New Phase', 'Tech Campus Building 4', 'Transitioning from foundation to structural steel. 15 new workers joining.', 'Identified Hazards: 1) Fall risk increases significantly in steel erection phase. 2) New workers need site-specific orientation. 3) Crane operations will begin - verify all certifications. 4) Electrical rough-in creates shock hazards.', 'claude-haiku-4.5', 'completed', 'Mike Chen'),
      ('cost_analysis', 'Safety ROI Analysis 2024', 'All Sites', 'Investment: $2.1M in safety programs. OSHA fine history. Incident costs.', 'ROI Analysis: Safety investment of $2.1M prevented estimated $4.8M in potential OSHA fines and $3.2M in incident-related costs. Net savings: $5.9M. Key drivers: Fall protection program (42%), training program (28%), equipment maintenance (18%).', 'claude-haiku-4.5', 'completed', 'John Administrator'),
      ('equipment_analysis', 'Equipment Replacement Priority', 'All Sites', 'Equipment inventory with age, condition, and maintenance history', 'Priority Replacements: 1) Potain MCT 88 crane (expired cert, high hours). 2) JLG 860SJ boom lift (sensor issues). 3) Putzmeister concrete pump (agitator failure). Estimated cost: $285,000. Risk reduction: 65% for equipment-related incidents.', 'claude-haiku-4.5', 'completed', 'Tom Garcia'),
      ('weather_risk', 'Hurricane Season Preparedness', 'Oceanview Resort', 'Coastal Florida construction, June-November hurricane season', 'Preparedness Score: 6/10. Gaps: 1) Crane tie-down procedure not documented. 2) Material securing plan incomplete. 3) Evacuation route needs update for current construction phase. Recommend: Complete all preparations by May 15.', 'claude-haiku-4.5', 'completed', 'Sarah Williams'),
      ('document_review', 'Permit Compliance Review', 'All Sites', 'All active permits and licenses across 16 sites', 'Review Results: 14 of 16 permits current. 1 EXPIRED: Crane operating permit at Oceanview Resort. 1 EXPIRING SOON: Demolition permit at Community Center (May 2024). Action required: Immediate crane permit renewal. Schedule demolition permit renewal.', 'claude-haiku-4.5', 'completed', 'Jane Inspector'),
      ('safety_score', 'Site Safety Scoring', 'All Sites', 'Inspection results, violations, incidents, training compliance for all sites', 'Safety Scores (out of 100): Riverside Mall: 95, Tech Campus: 92, Solar Farm: 88, Skyline Tower: 85, Central Park: 82, Airport: 80, Data Center: 78, Metro Hospital: 75, Mountain View: 73, Subway: 70, Waterfront: 68, Community Center: 65, Historic Library: 62, Interstate Bridge: 58, Oceanview: 52, Harbor Bridge: 48.', 'claude-haiku-4.5', 'completed', 'John Administrator'),
      ('regulation_update', 'OSHA Regulation Changes 2024', 'All Sites', 'New OSHA regulations and enforcement priorities for 2024', 'Key Changes: 1) Updated silica exposure limits effective June 2024. 2) New heat illness prevention standard proposed. 3) Increased penalty amounts (max $156K/willful). 4) Focus areas: falls, trenching, powered industrial vehicles. Action: Update all affected programs by May 2024.', 'claude-haiku-4.5', 'completed', 'Mike Chen'),
      ('ppe_optimization', 'PPE Inventory Optimization', 'All Sites', 'Current PPE inventory levels, usage rates, and lead times', 'Optimization Results: 2 items critically low (Tyvek coveralls, cooling vests). 3 items overstocked (safety glasses, earplugs, hard hats). Recommended: Reorder coveralls (200 units) and cooling vests (25 units) immediately. Reduce safety glasses order by 50% next cycle.', 'claude-haiku-4.5', 'completed', 'Tom Garcia'),
      ('emergency_review', 'Emergency Plan Effectiveness', 'All Sites', 'Drill results, response times, plan completeness scores', 'Effectiveness Score: 78/100. Strengths: Medical emergency response (95%), fire response (88%). Weaknesses: Crane emergency plan outdated (Oceanview), tunnel rescue drill overdue (Subway). 4 sites need drill scheduling. Recommend: Quarterly drill calendar implementation.', 'claude-haiku-4.5', 'completed', 'Sarah Williams'),
      ('worker_safety', 'Worker Certification Compliance', 'All Sites', 'All worker certifications, expiry dates, and training records', 'Compliance Rate: 94%. At-risk certifications: 3 expiring within 30 days (Brian Moore HAZWOPER, Cindy Park Blasting, Kim Lee Fire Watch). 2 workers need recertification before assignment. All OSHA 10/30 certifications current.', 'claude-haiku-4.5', 'completed', 'Jane Inspector'),
      ('trend_analysis', 'Incident Trend Analysis', 'All Sites', 'All incidents from Jan-Mar 2024', 'Trends: Falls remain #1 incident type (31%). Struck-by incidents increasing (up 15% from Q4). Heat-related incidents seasonal (expected increase Q2-Q3). Near-miss reporting improved 40% indicating better safety culture. Focus areas: Fall prevention at height, tool tethering, summer heat protocols.', 'claude-haiku-4.5', 'completed', 'John Administrator')
    `);

    // 14. Daily Reports
    await client.query(`
      CREATE TABLE daily_reports (
        id SERIAL PRIMARY KEY,
        report_date DATE NOT NULL,
        site_name VARCHAR(255) NOT NULL,
        submitted_by VARCHAR(255) NOT NULL,
        weather VARCHAR(100),
        temperature VARCHAR(50),
        workers_onsite INTEGER,
        work_summary TEXT NOT NULL,
        safety_observations TEXT,
        incidents_today INTEGER DEFAULT 0,
        near_misses INTEGER DEFAULT 0,
        toolbox_talk_topic VARCHAR(255),
        visitors TEXT,
        equipment_issues TEXT,
        status VARCHAR(50) DEFAULT 'submitted',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`INSERT INTO daily_reports (report_date, site_name, submitted_by, weather, temperature, workers_onsite, work_summary, safety_observations, incidents_today, near_misses, toolbox_talk_topic, visitors, equipment_issues, status) VALUES
      ('2024-03-15', 'Skyline Tower Project', 'Jane Inspector', 'Clear', '72°F', 145, 'Steel erection continued on floors 18-20. Concrete pour completed on floor 15. MEP rough-in on floors 8-12.', 'All fall protection in use. Good housekeeping on all levels. Minor debris on floor 12 addressed by end of shift.', 0, 1, 'Tool tethering and dropped object prevention', 'OSHA compliance officer (routine)', 'None', 'approved'),
      ('2024-03-15', 'Harbor Bridge Renovation', 'Mike Chen', 'Foggy', '58°F', 89, 'East platform demolition 60% complete. New bearing installation on pier 3. Guardrail installation in progress.', 'Fall protection gaps identified on east side - corrective action initiated. Visibility limited due to fog - additional lighting deployed.', 1, 2, 'Working in limited visibility conditions', 'Bridge authority inspector', 'Boom lift sensor intermittent - tagged out', 'submitted'),
      ('2024-03-14', 'Metro Hospital Wing B', 'Sarah Williams', 'Overcast', '45°F', 32, 'Foundation excavation 90% complete. Rebar placement for grade beams started. Utility connections being verified.', 'Trench safety significantly improved after corrective actions. All shoring properly installed and inspected.', 0, 0, 'Excavation safety and soil types', 'Hospital administration representative', 'None', 'approved'),
      ('2024-03-14', 'Tech Campus Building 4', 'Tom Garcia', 'Clear', '75°F', 15, 'Site preparation complete. Survey stakes placed for foundation. Equipment mobilization underway.', 'New workers received site orientation. All permits verified and posted. PPE compliance 100%.', 0, 0, 'New site safety orientation overview', 'Client project manager', 'None', 'approved'),
      ('2024-03-13', 'Riverside Mall Expansion', 'Jane Inspector', 'Sunny', '80°F', 200, 'Structural steel erection on Building B. Curtain wall installation on Building A. Interior framing floors 1-3.', 'Excellent safety culture observed. Workers proactively correcting minor issues. Heat stress precautions in effect.', 0, 0, 'Heat stress prevention and hydration', 'Mall property management', 'Forklift backup alarm repaired', 'approved'),
      ('2024-03-13', 'Oceanview Resort', 'Sarah Williams', 'Humid', '85°F', 120, 'Crane operations suspended pending recertification. Ground-level concrete work continued. Pool area excavation.', 'Crane certification expired - all crane work stopped. Workers redirected to ground-level tasks. High humidity increasing heat risk.', 0, 1, 'Equipment certification requirements', 'Resort owner representative', 'Tower crane - certification expired', 'submitted'),
      ('2024-03-12', 'Central Park Condos', 'Mike Chen', 'Rainy', '50°F', 78, 'Interior electrical and plumbing rough-in floors 1-6. Exterior waterproofing on foundation walls.', 'Wet conditions creating slip hazards - additional mats deployed. Previous electrical violations corrected and verified.', 0, 1, 'Wet weather safety precautions', 'City building inspector', 'None', 'approved'),
      ('2024-03-12', 'Airport Terminal C', 'Tom Garcia', 'Clear', '55°F', 310, 'Elevator shaft construction. Terminal roof steel installation. Baggage system rough-in Level 1.', 'Active runway proximity protocols followed. All workers in high-vis vests. Vehicle-pedestrian separation maintained.', 0, 0, 'Airport-specific safety requirements', 'FAA inspector, airline operations', 'None', 'approved'),
      ('2024-03-11', 'Historic Library Restoration', 'Jane Inspector', 'Cloudy', '42°F', 45, 'Lead paint abatement in West Reading Room. Asbestos removal in basement continuing. Structural assessment of dome.', 'All containment barriers intact. Air monitoring within limits. Worker decontamination procedures followed correctly.', 0, 0, 'Hazardous material handling procedures', 'Historic preservation officer', 'HEPA vacuum filter replaced', 'approved'),
      ('2024-03-11', 'Mountain View Apartments', 'Sarah Williams', 'Rainy', '48°F', 65, 'Retaining wall forms set for Section C. Underground utilities installation. Grading of Lot B.', 'Hillside stability being monitored due to rain. Dewatering pumps operational. Erosion controls in place.', 0, 0, 'Slope stability and weather impacts', 'Geotechnical engineer (monitoring visit)', 'Dewatering pump 2 running rough', 'approved'),
      ('2024-03-10', 'Interstate Bridge 95', 'Mike Chen', 'Clear', '38°F', 40, 'Bridge deck demolition northbound lanes. Temporary support installation. Traffic control in effect.', 'Traffic control plan deficiencies noted - revision requested. Night lighting inadequate for night shift work.', 0, 2, 'Highway work zone safety', 'State highway authority inspector', 'Light tower 3 bulb replaced', 'submitted'),
      ('2024-03-10', 'Solar Farm Installation', 'Tom Garcia', 'Sunny', '95°F', 85, 'Panel mounting on arrays 15-22. Inverter station foundation pour. Cable trench excavation Section 8.', 'Heat index 105°F - modified work schedule implemented. Extra hydration breaks. Two workers showed early heat stress signs - moved to shade.', 0, 0, 'Heat illness recognition and response', 'None', 'None', 'approved'),
      ('2024-03-09', 'Subway Extension Line 3', 'Jane Inspector', 'N/A', 'N/A', 55, 'Tunnel boring machine advance 12 meters. Ring installation segments 445-448. Cross-passage excavation started.', 'Confined space entry permits verified for all entries. Air monitoring continuous. Rescue team on standby.', 0, 0, 'Underground emergency procedures', 'Transit authority safety officer', 'Air monitor calibration due tomorrow', 'approved'),
      ('2024-03-09', 'Waterfront Office Complex', 'Mike Chen', 'Overcast', '52°F', 92, 'Structural steel erection floors 3-4. Welding connections floor 2. Scaffold erection for curtain wall.', 'New safety nets installed after previous incident. Scaffold load signs posted on all platforms. Fire watch active during all welding.', 0, 0, 'Scaffold load capacity awareness', 'Insurance company safety representative', 'Concrete pump agitator sluggish', 'approved'),
      ('2024-03-08', 'Community Center Rebuild', 'Sarah Williams', 'Partly Cloudy', '65°F', 28, 'Demolition debris removal complete. Foundation layout surveyed. Footing excavation started.', 'Site fully cleared and safe. Silica exposure monitoring in place for concrete work. All flammable materials properly stored.', 0, 0, 'Site cleanup and housekeeping standards', 'Community board members (site tour)', 'None', 'approved'),
      ('2024-03-08', 'Data Center Facility', 'Tom Garcia', 'Clear', '70°F', 110, 'Raised floor installation 75% complete. Generator room electrical rough-in. Fire suppression piping Level 2.', 'Hot work permits being followed correctly after recent incident. All fire extinguishers inspected. Good housekeeping throughout.', 0, 0, 'Fire prevention during construction', 'Data center operations team', 'Generator fuel filter replaced', 'approved')
    `);

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
