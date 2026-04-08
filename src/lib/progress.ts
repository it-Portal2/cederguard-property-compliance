import { Programme } from '../store/useStore';

export interface PillarStatus {
  label: string;
  status: 'complete' | 'warning' | 'error' | 'not-started';
  info: string;
}

export interface ProgrammeProgress {
  percentage: number;
  pillars: PillarStatus[];
}

export function calculateProgrammeProgress(programme: Programme | null | undefined): ProgrammeProgress {
  if (!programme) {
    return {
      percentage: 0,
      pillars: [
        { label: 'Regulatory Compliance Framework', status: 'not-started', info: 'Defined key regulatory obligations and standards.' },
        { label: 'Strategic Risk Appetite', status: 'not-started', info: 'Setting the risk boundary for the programme.' },
        { label: 'Governance & Board Setup', status: 'not-started', info: 'Defining oversight structure and key personnel.' },
        { label: 'Strategic Objectives', status: 'not-started', info: 'Mandatory for AI alignment and reporting.' },
      ]
    };
  }

  const complianceDone = !!programme.regulatoryObligations && 
    (Array.isArray(programme.regulatoryObligations) ? programme.regulatoryObligations.length > 0 : programme.regulatoryObligations !== 'Draft');
  
  const riskDone = !!programme.riskAppetite && !!programme.aiRiskDiscoveryDone;
  const riskPartial = !!programme.riskAppetite;

  const govDone = (programme.boardMembers?.length || 0) > 0 || !!programme.boardComposition || !!programme.deliveryTeamDone;
  
  const objectivesDone = !!programme.strategicObjectives && programme.strategicObjectives.length > 0;

  const pillars: PillarStatus[] = [
    { 
      label: 'Regulatory Compliance Framework', 
      status: complianceDone ? 'complete' : 'error', 
      info: 'Defined key regulatory obligations and standards.' 
    },
    { 
      label: 'Strategic Risk Appetite', 
      status: riskDone ? 'complete' : (riskPartial ? 'warning' : 'error'), 
      info: 'Setting the risk boundary for the programme.' 
    },
    { 
      label: 'Governance & Board Setup', 
      status: govDone ? 'complete' : 'warning', 
      info: 'Defining oversight structure and key personnel.' 
    },
    { 
      label: 'Strategic Objectives', 
      status: objectivesDone ? 'complete' : 'warning', 
      info: 'Mandatory for AI alignment and reporting.' 
    },
  ];

  const completedCount = pillars.filter(p => p.status === 'complete').length;
  const percentage = programme.isPublished ? 100 : Math.round((completedCount / pillars.length) * 100);

  return {
    percentage,
    pillars
  };
}

export function calculateProjectProgress(project: any | null | undefined): { percentage: number } {
  if (!project) return { percentage: 0 };
  if (project.isPublished) return { percentage: 100 };
  
  let percentage = 25; // Base creation
  if (project.complianceSetupDone) percentage += 25;
  if (project.riskSetupDone) percentage += 25;
  if (project.aiRiskDiscoveryDone) percentage += 25;
  
  return { percentage: Math.min(percentage, 100) };
}
