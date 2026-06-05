export const RIBA_STAGES = [
  { id: 'S0', label: 'S0 - Strategic Definition' },
  { id: 'S1', label: 'S1 - Preparation & Briefing' },
  { id: 'S2', label: 'S2 - Concept Design' },
  { id: 'S3', label: 'S3 - Spatial Coordination' },
  { id: 'S4', label: 'S4 - Technical Design' },
  { id: 'S5', label: 'S5 - Manufacturing & Construction' },
  { id: 'S6', label: 'S6 - Handover' },
  { id: 'S7', label: 'S7 - Use' }
];

export const getRIBALabel = (id: string) => {
  return RIBA_STAGES.find(s => s.id === id)?.label || id;
};
