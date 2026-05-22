export interface ClassificationResult {
  requiredServices: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedUnits: number;
  specialNeeds: string[];
  priority: number; // 1-10 (10 highest)
}

export function classifyIncident(
  description: string,
  victimCount: number = 1
): ClassificationResult {
  const lowerDesc = description.toLowerCase();
  
  let isFire = false;
  let isMedical = false;
  let isRescue = false;
  
  if (lowerDesc.includes('fire') || lowerDesc.includes('smoke') || lowerDesc.includes('burn')) {
    isFire = true;
  }
  if (lowerDesc.includes('heart') || lowerDesc.includes('stroke') || lowerDesc.includes('breath') || lowerDesc.includes('pain') || lowerDesc.includes('bleed') || lowerDesc.includes('fall')) {
    isMedical = true;
  }
  if (lowerDesc.includes('trapped') || lowerDesc.includes('crash') || lowerDesc.includes('drown')) {
    isRescue = true;
  }
  
  // Default if nothing matched
  if (!isFire && !isMedical && !isRescue) {
    isMedical = true;
  }

  const requiredServices: string[] = [];
  if (isFire) requiredServices.push('firefighter');
  if (isMedical) requiredServices.push('ambulance');
  if (isRescue) requiredServices.push('rescue');

  let severity: ClassificationResult['severity'] = 'low';
  let priority = 1;
  const specialNeeds: string[] = [];

  if (lowerDesc.includes('unconscious') || lowerDesc.includes('not breathing') || lowerDesc.includes('heart attack')) {
    severity = 'critical';
    priority = 10;
    specialNeeds.push('ALS');
  } else if (lowerDesc.includes('crash') || lowerDesc.includes('fire') || victimCount > 2) {
    severity = 'high';
    priority = 8;
  } else if (lowerDesc.includes('pain') || lowerDesc.includes('bleed') || lowerDesc.includes('smoke')) {
    severity = 'medium';
    priority = 5;
  }

  // Victim multiplier logic
  if (victimCount > 5) {
    severity = 'critical';
    priority = Math.min(10, priority + 3);
  } else if (victimCount > 2) {
    priority = Math.min(10, priority + 2);
  }

  return {
    requiredServices,
    severity,
    estimatedUnits: Math.ceil(victimCount / 2),
    specialNeeds,
    priority,
  };
}
