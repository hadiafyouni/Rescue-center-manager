import { describe, it, expect } from 'vitest';
import { classifyIncident } from './rules';

describe('classifyIncident', () => {
  it('classifies a medical incident (heart attack)', () => {
    const res = classifyIncident('Patient is having a heart attack');
    expect(res.requiredServices).toContain('ambulance');
    expect(res.severity).toBe('critical');
    expect(res.priority).toBe(10);
    expect(res.specialNeeds).toContain('ALS');
  });

  it('classifies a fire incident with high severity', () => {
    const res = classifyIncident('Huge apartment fire, 3 victims', 3);
    expect(res.requiredServices).toContain('firefighter');
    expect(res.severity).toBe('high');
    expect(res.priority).toBe(10); // 8 + 2 from victims
  });

  it('classifies a basic medical fall', () => {
    const res = classifyIncident('Person fall down stairs, knee pain');
    expect(res.requiredServices).toContain('ambulance');
    expect(res.severity).toBe('medium');
    expect(res.priority).toBe(5);
  });
  
  it('classifies a rescue incident with multiple victims', () => {
    const res = classifyIncident('Car crash, people trapped', 4);
    expect(res.requiredServices).toContain('rescue');
    expect(res.severity).toBe('high');
    expect(res.priority).toBe(10); // 8 + 2
  });
});
