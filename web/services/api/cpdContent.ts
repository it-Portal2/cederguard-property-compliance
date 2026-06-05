export interface SlideData {
  id: string;
  title: string;
  bullets: string[];
}

const mockDb: Record<string, SlideData[]> = {
  cpd1: [
    {
      id: 'slide-1',
      title: 'Introduction to Building Safety Act 2022',
      bullets: [
        'Overhauls the regulatory landscape for UK building safety.',
        'Direct response to the Grenfell Tower tragedy to prevent recurrence.',
        'Requires clear accountability for safety risks throughout a building\'s lifecycle.',
        'Applies primarily, but not exclusively, to High-Risk Buildings (HRBs).'
      ]
    },
    {
      id: 'slide-2',
      title: 'What represents a High-Risk Building (HRB)?',
      bullets: [
        'Buildings that are at least 18 metres tall or have 7 or more storeys.',
        'Must contain at least two residential units.',
        'Care homes and hospitals meeting the height criteria.',
        'Stricter regulations apply during design, construction, and occupation phases.'
      ]
    },
    {
      id: 'slide-3',
      title: 'The Golden Thread of Information',
      bullets: [
        'A digital trail of information about a building\'s safety design and construction.',
        'Must be kept updated and accessible throughout the building\'s entire lifecycle.',
        'Ensures future owners/managers have accurate schematics and safety logs.',
        'Critical for demonstrating active compliance to regulators.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Dutyholders & The Accountable Person',
      bullets: [
        'Principal Designers and Contractors bear explicit statutory duties during build phase.',
        'The Principal Accountable Person (PAP) is responsible for occupied HRBs.',
        'PAP must register the building with the Building Safety Regulator (BSR).',
        'PAP issues the Safety Case Report detailing structural and fire risks.'
      ]
    },
    {
      id: 'slide-5',
      title: 'Enforcement & Penalties',
      bullets: [
        'The Building Safety Regulator has powers to stop construction (Stop Notices).',
        'Severe financial penalties and potential imprisonment for non-compliance.',
        'Directors and managers can be held personally liable for corporate offenses.',
        'Conclusion: Proactive compliance and absolute transparency are legally mandated.'
      ]
    }
  ],
  cpd2: [
    {
      id: 'slide-1',
      title: 'Fire Safety Mitigation - Core Principles',
      bullets: [
        'Proactive fire risk assessment (FRA) is the bedrock of compliance.',
        'Compartmentation: Restricting the spread of fire and smoke within the building.',
        'Ensuring clear, uncompromised escape routes for all occupants.',
        'Regular auditing of active suppression systems (e.g., sprinklers, alarms).'
      ]
    },
    {
      id: 'slide-2',
      title: 'Material Science & Cladding',
      bullets: [
        'Strict limitations on the use of combustible materials in external walls.',
        'EWS1 forms: Evaluating the fire safety of external wall systems.',
        'Banning of ACM (Aluminium Composite Material) cladding on HRBs.',
        'Continuous checks for material degradation or unauthorized modification.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Active vs. Passive Fire Protection',
      bullets: [
        'Passive: Fire doors, intumescent seals, fire-stopping collars, and compartment walls.',
        'Active: Smoke detectors, sprinkler systems, AOV (Automatic Opening Vents).',
        'Both systems must be inspected dynamically and maintained concurrently.',
        'Failure in one system places total reliance on the other, increasing risk.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Resident Engagement',
      bullets: [
        'A statutory requirement to involve residents in building safety decisions.',
        'Clear communication of escape strategies (e.g., Stay Put vs. Evacuate).',
        'Empowering residents to report fire hazards easily and securely.',
        'Documentation of all engagements and complaints is subject to audit.'
      ]
    }
  ],
  cpd3: [
    {
      id: 'slide-1',
      title: 'Introduction to Property Risk Frameworks',
      bullets: [
        'A strong Risk Management Framework (RMF) is essential for operational resilience.',
        'Integrates policies, procedures, and oversight directly into daily workflow.',
        'Shifts the organisational mindset from reactive firefighting to proactive mitigation.',
        'Maintains absolute alignment with statutory compliance mandates.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Identifying and Assessing Risks',
      bullets: [
        'Utilize comprehensive audits to baseline current facility conditions.',
        'Implement standardized risk scoring (e.g., Likelihood × Impact).',
        'Involve ground-level staff in hazard identification to ensure realistic mapping.',
        'Continuously update the risk register as building usage evolves.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Mitigation Strategies & Controls',
      bullets: [
        'Avoidance: Eliminating the root cause of the risk entirely.',
        'Reduction: Implementing controls to minimize probability or severity.',
        'Transfer: Using insurance or third-party outsourcing to manage liability.',
        'Acceptance: Acknowledging residual risks that cannot practically be eliminated.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Continuous Monitoring & Review',
      bullets: [
        'Risk profiles are highly dynamic and require consistent re-evaluation.',
        'Establish KPI dashboards to track the effectiveness of active controls.',
        'Schedule formal reviews quarterly, or immediately following any significant incident.',
        'Foster an open culture where near-miss reporting is encouraged and rewarded.'
      ]
    }
  ],
  cpd4: [
    {
      id: 'slide-1',
      title: 'HVAC Energy Efficiency Standards',
      bullets: [
        'HVAC systems account for up to 40% of standard commercial building energy use.',
        'Strict new efficiency standards are driving the transition toward sustainable tech.',
        'Non-compliance risks severe financial penalties and decreased asset valuation.',
        'Regular maintenance is critical to sustaining optimal basinal efficiency.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Preventative Maintenance Regimes',
      bullets: [
        'Filter replacements and coil cleanings must adhere to strict operational schedules.',
        'Neglected systems suffer a 10-20% drop in efficiency within the first year.',
        'Implement predictive maintenance using IoT sensors and vibration analysis.',
        'Detailed maintenance logs are mandatory for regulatory compliance auditing.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Ventilation and Indoor Air Quality (IAQ)',
      bullets: [
        'Proper ventilation is legally required to ensure occupant health and safety.',
        'Balance fresh air intake with energy-efficient heat recovery systems.',
        'Monitor CO2 levels to dynamically adjust airflow based on real-time occupancy.',
        'Poor IAQ directly correlates with decreased productivity and increased sickness.'
      ]
    },
    {
      id: 'slide-4',
      title: 'F-Gas Regulations & Refrigerant Management',
      bullets: [
        'Strict legal frameworks govern the handling and disposal of fluorinated gases.',
        'Mandatory leak checking schedules must be adhered to explicitly.',
        'Only certified technicians are legally permitted to handle refrigerant circuits.',
        'Transitioning to low-GWP (Global Warming Potential) alternatives is a statutory goal.'
      ]
    }
  ],
  cpd5: [
    {
      id: 'slide-1',
      title: 'Understanding Legionella Risks',
      bullets: [
        'Legionella bacteria is the primary cause of Legionnaires’ disease, a fatal pneumonia.',
        'Thrives in artificial water systems at temperatures between 20°C and 45°C.',
        'Transmission occurs via inhalation of contaminated aerosolized water droplets.',
        'High-risk areas include cooling towers, evaporative condensers, and large hot water systems.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Statutory Duties (L8 Approved Code of Practice)',
      bullets: [
        'Employers and landlords bear a legal duty to protect employees and tenants.',
        'Must appoint a competent "Responsible Person" to oversee water safety protocols.',
        'Failure to act on Known risks can lead to prosecution under the Health and Safety at Work Act.',
        'Record keeping must be meticulous, retained for a minimum of 5 years.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Risk Assessment Protocols',
      bullets: [
        'Conduct a comprehensive Legonella Risk Assessment (LRA) every two years minimum.',
        'Identify all potential sources of aerosol generation within the building ecosystem.',
        'Evaluate the susceptibility of building occupants (e.g., healthcare facilities pose higher risks).',
        'Assess the efficacy of current control measures and systemic redundancies.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Temperature Control & Chemical Dosing',
      bullets: [
        'Cold water must be stored and distributed below 20°C to inhibit bacterial growth.',
        'Hot water must be stored at 60°C minimum and distributed at 50°C minimum.',
        'Where temperature control is unviable, implement biocidal treatments (e.g., Chlorine Dioxide).',
        'Regular flushing of infrequently used outlets (dead legs) is a mandatory control measure.'
      ]
    },
    {
      id: 'slide-5',
      title: 'Monitoring and Corrective Actions',
      bullets: [
        'Establish a routine sampling program utilizing UKAS-accredited laboratories.',
        'Immediate remedial action is required if CFU (Colony Forming Units) exceed safety thresholds.',
        'Review and update the written scheme of control whenever the water system is fundamentally altered.',
        'Consistent vigilance is the only reliable methodology for preventing outbreaks.'
      ]
    }
  ],
  cpd6: [
    {
      id: 'slide-1',
      title: 'Understanding Asbestos in Buildings',
      bullets: [
        'Asbestos was extensively used in UK construction prior to its total ban in 1999.',
        'Poses severe respiratory risks (mesothelioma) when fibres are inhaled.',
        'Commonly found in insulation, ceiling tiles, cement roofing, and textured coatings.',
        'As long as it is undisturbed and in good condition, it often poses minimal immediate risk.'
      ]
    },
    {
      id: 'slide-2',
      title: 'The Duty to Manage (CAR 2012)',
      bullets: [
        'The Control of Asbestos Regulations 2012 mandates a clear "Duty to Manage".',
        'Applies to all non-domestic premises and common areas of multi-occupancy housing.',
        'Requires an up-to-date Asbestos Register to track location and condition.',
        'Information must be provided to any contractor before they commence invasive work.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Types of Asbestos Surveys',
      bullets: [
        'Management Survey: Standard inspection to locate general asbestos-containing materials (ACMs).',
        'Refurbishment & Demolition (R&D) Survey: Intrusive survey required before structural alterations.',
        'Surveys must be conducted by competent strictly accredited professionals.',
        'R&D surveys require full vacating of the affected area due to destructive testing.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Remediation and Removal',
      bullets: [
        'Removal is a last resort; encapsulation or sealing is often preferred.',
        'High-risk removal requires a Licensed Asbestos Contractor and 14-day HSE notification.',
        'Strict decontamination protocols and air clearance testing post-removal.',
        'A comprehensive audit trail of legal disposal is mandatory.'
      ]
    }
  ],
  cpd7: [
    {
      id: 'slide-1',
      title: 'Supply Chain Compliance Risks',
      bullets: [
        'Outsourcing work does not outsource your ultimate compliance liability.',
        'Failures by sub-contractors directly impact the Accountable Person’s legal standing.',
        'Modern slavery, health & safety, and financial instability are primary supply chain risks.',
        'Rigorous vetting frameworks are essential to shield the organisation.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Due Diligence & Vetting',
      bullets: [
        'Verify certifications (e.g., CHAS, SafeContractor, ISO standards).',
        'Assess financial health to ensure the contractor can complete long-term projects.',
        'Review past health and safety records and HSE enforcement notices.',
        'Implement mandatory onboarding protocols for all new service providers.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Contractual Safety Obligations',
      bullets: [
        'Contracts must explicitly outline compliance responsibilities and KPIs.',
        'Require immediate reporting of near-misses and safety incidents on site.',
        'Ensure the "Golden Thread" principle is passed down to sub-contractors.',
        'Establish clear financial penalties for severe compliance breaches.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Performance Monitoring',
      bullets: [
        'Conduct periodic random spot-checks on active contractor work.',
        'Implement continuous performance reviews rather than waiting for annual renewals.',
        'Maintain a dynamic "Approved Suppliers List" with real-time compliance status.',
        'Swiftly sever ties with consistently underperforming or non-compliant vendors.'
      ]
    }
  ],
  cpd8: [
    {
      id: 'slide-1',
      title: 'EICR Statutory Requirements',
      bullets: [
        'Electrical Installation Condition Reports (EICR) are legally mandatory.',
        'All electrical installations degrade; testing identifies hidden fire and shock hazards.',
        'Typically required every 5 years for tenanted properties and HMOs.',
        'Failure to possess a valid EICR nullifies insurance and risks prosecution.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Understanding EICR Coding',
      bullets: [
        'Code C1: Danger present, immediate risk of injury—action required immediately.',
        'Code C2: Potentially dangerous—urgent remedial action required.',
        'Code C3: Improvement recommended, but not non-compliant.',
        'A report containing any C1 or C2 codes is deemed "Unsatisfactory".'
      ]
    },
    {
      id: 'slide-3',
      title: 'Portable Appliance Testing (PAT)',
      bullets: [
        'Landlords must ensure any supplied electrical appliances are safe.',
        'Routine visual inspections combined with formal instrumental testing.',
        'Recommended annually for high-usage items in communal areas.',
        'Maintains a legally-defensible paper trail of equipment safety diligence.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Emergency Lighting Compliance',
      bullets: [
        'Critical for safe evacuation during power failures or fire events.',
        'Requires monthly functional testing (flick tests) and annual full-duration testing.',
        'Batteries must hold charge for the legally specified duration (often 3 hours).',
        'Immediate replacement of failed luminaires is a non-negotiable safety priority.'
      ]
    }
  ],
  cpd9: [
    {
      id: 'slide-1',
      title: 'GDPR in Property Management',
      bullets: [
        'Property managers handle vast amounts of sensitive Personal Identifiable Information (PII).',
        'Data must only be collected for explicitly stated, legitimate purposes.',
        'Strict limits on data retention periods (e.g., destroying tenancy info post-checkout).',
        'Penalties for breaches can reach up to 4% of global turnover.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Managing CCTV & Access Logs',
      bullets: [
        'CCTV systems in communal areas are subject to strict data laws.',
        'Clear signage must be displayed indicating recording and the purpose.',
        'Footage cannot be shared indiscriminately; strict protocols apply to law enforcement requests.',
        'Electronic fob systems tracking resident movement must balance security with privacy.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Securing Financial Data',
      bullets: [
        'Rent processing involves processing bank details and credit checks.',
        'Digital storage must utilize enterprise-grade encryption and access controls.',
        'Physical documents must be kept in strictly controlled secure environments.',
        'Annual cybersecurity training is mandatory for all staff handling this data.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Data Breach Protocols',
      bullets: [
        'Any significant breach must be reported to the ICO within 72 hours.',
        'Have a pre-defined Incident Response Plan ready to deploy.',
        'Affected residents must be notified promptly if the breach risks their rights.',
        'Transparency mitigates regulatory wrath; cover-ups guarantee it.'
      ]
    }
  ],
  cpd10: [
    {
      id: 'slide-1',
      title: 'Defining a Crisis Framework',
      bullets: [
        'A crisis is any event threatening life safety, structural integrity, or reputation.',
        'The Incident Response Plan (IRP) dictates the first crucial hours of an emergency.',
        'Roles and responsibilities must be explicitly defined before an incident occurs.',
        'The plan must encompass floods, fires, structural failures, and cyber-attacks.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Initial Response & Triage',
      bullets: [
        'Priority 1: Life safety and evacuation protocols over all else.',
        'Priority 2: Stabilising the immediate threat and engaging emergency services.',
        'Priority 3: Establishing a secure perimeter and activating the command center.',
        'Decisiveness is more valuable than perfect information in the first 60 minutes.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Stakeholder & Resident Comms',
      bullets: [
        'In the absence of clear communication, panic and misinformation fill the void.',
        'Establish a single, authoritative source of updates (e.g., an SMS broadcast).',
        'Ensure the tone is calm, empathetic, and strictly factual.',
        'Never speculate on causes or liabilities during an active incident.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Post-Incident Review',
      bullets: [
        'Conduct a "blame-free" post-mortem after the dust settles.',
        'Evaluate what worked, what failed, and the speed of response.',
        'Update the risk register and IRP based on real-world findings.',
        'Continuous improvement turns incidents into organizational armor.'
      ]
    }
  ],
  cpd11: [
    {
      id: 'slide-1',
      title: 'LOLER 1998 Explained',
      bullets: [
        'Lifting Operations and Lifting Equipment Regulations 1998 are statutory law.',
        'Passenger lifts are classed as critical life-safety and operational equipment.',
        'Requires rigorous "Thorough Examinations" by competent, independent engineers.',
        'Failure to comply can result in lift shutdown notices and prosecution.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Routine Maintenance vs Statutory Inspections',
      bullets: [
        'Maintenance: Keeping the lift operational, lubricating parts, and fixing wear-and-tear.',
        'Thorough Examination: A legally mandated, impartial safety audit (typically every 6 months).',
        'The maintenance contractor and the inspecting engineer should ideally be separate entities.',
        'All defects noted in the Thorough Examination must be actioned immediately.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Entrapment Rescue Procedures',
      bullets: [
        'Clear protocols must be in place for resident entrapment scenarios.',
        'Emergency communication lines within the lift car must be tested regularly.',
        'Only trained professionals (or emergency services) should attempt physical extraction.',
        'Prolonged entrapments cause immense distress and severe reputational damage.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Modernisation & Lifecycle Management',
      bullets: [
        'Lifts have a definitive lifespan (typically 20-25 years).',
        'Planned preventative modernization avoids catastrophic, prolonged breakdowns.',
        'Budgeting for major component replacement must be factored into standard service charges.',
        'Upgrading drives and controls drastically improves building energy efficiency.'
      ]
    }
  ],
  cpd12: [
    {
      id: 'slide-1',
      title: 'The Golden Thread for Residents',
      bullets: [
        'The Building Safety Act mandates residents receive core safety information.',
        'Complex compliance jargon must be translated into accessible, clear terms.',
        'Residents are active participants in building safety, not passive occupants.',
        'Transparency builds trust and increases compliance with building rules.'
      ]
    },
    {
      id: 'slide-2',
      title: 'Structuring Engagement Panels',
      bullets: [
        'Establish formal resident panels or committees to discuss safety matters.',
        'Provide residents an official voice in major maintenance or remediation decisions.',
        'Meeting minutes and decisions must be logged and distributed to all leaseholders.',
        'Panels help defuse adversarial landlord-tenant dynamics.'
      ]
    },
    {
      id: 'slide-3',
      title: 'Handling Complaints & Feedback',
      bullets: [
        'Implement a frictionless digital and physical method for safety reporting.',
        'Acknowledge reports immediately and provide transparent timelines for resolution.',
        'Safety complaints must bypass standard maintenance queues and trigger priority triage.',
        'Escalate persistent safety complaints directly to the Principal Accountable Person.'
      ]
    },
    {
      id: 'slide-4',
      title: 'Transparent Compliance Reporting',
      bullets: [
        'Publish high-level safety performance dashboards in communal areas or portals.',
        'Showcase the completion rate of FRAs, EICRs, and maintenance tasks.',
        'Demonstrating proactive diligence reassures residents and reduces liability.',
        'A fully informed resident base is the strongest defense against regulatory scrutiny.'
      ]
    }
  ]
};

const defaultSlides: SlideData[] = [
  {
    id: 'default-1',
    title: 'Loading Module Content',
    bullets: [
      'Welcome to Cedar Training.',
      'This module content has not yet been authored by an administrator.',
      'Please check back later or contact your principal accountable person.',
      'Closing this window will return you to the main dashboard.'
    ]
  }
];

export const fetchCPDContent = async (moduleId: string): Promise<SlideData[]> => {
  // Simulate network latency (800ms)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockDb[moduleId] || defaultSlides);
    }, 800);
  });
};
