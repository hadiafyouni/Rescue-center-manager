import { CandidateUnit } from './candidates';
import { ClassificationResult } from '../classifier/rules';

export interface ScoredCandidate extends CandidateUnit {
  etaSeconds: number;
  score: number;
  polyline: string;
}

export function scoreCandidates(
  candidatesWithEta: (CandidateUnit & { etaSeconds: number; polyline: string })[],
  classification: ClassificationResult
): ScoredCandidate[] {
  return candidatesWithEta.map(c => {
    let score = 100;
    
    // ETA is primary factor. Deduct 1 point per 30 seconds of ETA.
    score -= (c.etaSeconds / 30);
    
    // Equipment match (ALS requested but BLS available -> deduct 20)
    if (classification.specialNeeds.includes('ALS') && c.equipment_level === 'BLS') {
      score -= 20;
    }
    
    // Crew level (Paramedic requested but EMT available -> deduct 15)
    if (classification.severity === 'critical' && c.crew_level === 'emt') {
      score -= 15;
    }

    return { ...c, score };
  }).sort((a, b) => b.score - a.score);
}
