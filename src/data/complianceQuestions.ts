import { 
  Building2, 
  Users, 
  Coins, 
  ShieldAlert, 
  Home, 
  Construction,
  AlertTriangle,
  FileText
} from 'lucide-react';

export interface Question {
  id: string;
  type: 'toggle' | 'select' | 'multi' | 'number';
  label: string;
  description?: string;
  options?: string[];
  trigger?: string;
  field?: string;
}

export interface QuestionPhase {
  id: string;
  num: string;
  title: string;
  hint: string;
  questions: Question[];
}

export const PROGRAMME_PHASES: QuestionPhase[] = [
  {
    id: 'prog_org', num: '01',
    title: 'Organisation & Regulatory Status',
    hint: 'Determines whether housing regulatory oversight applies to this programme.',
    questions: [
      { id: 'q1_1', type: 'toggle', label: 'Is the programme being delivered by a Local Authority?' },
      { id: 'q1_2', type: 'toggle', label: 'Is the programme being delivered by a Registered Provider / Housing Association?' },
      { id: 'q1_3', type: 'toggle', label: 'Is the organisation regulated by the Regulator of Social Housing (RSH)?', trigger: 'RSH regulation triggers mandatory Consumer Standards compliance and reporting obligations.' },
      { id: 'q1_4', type: 'toggle', label: 'Will the programme deliver social or affordable housing units?' },
      { id: 'q1_5', type: 'toggle', label: 'Will the programme require reporting to the Regulator of Social Housing?', trigger: 'RSH reporting requires formal data returns and evidence packs.' },
      { id: 'q1_6', type: 'toggle', label: 'Will the programme involve public sector funding or government grants?', trigger: 'Public funding triggers Homes England AHP compliance and value-for-money obligations.' }
    ]
  },
  {
    id: 'prog_tenure', num: '02',
    title: 'Housing Tenure & Residents',
    hint: 'Determines obligations under housing law and consumer standards.',
    questions: [
      { id: 'q2_tenures', type: 'multi', label: 'What housing tenures are included in the programme?', options: ['Social Rent', 'Affordable Rent', 'Shared Ownership', 'Leasehold', 'Temporary Accommodation', 'Supported Housing', 'Market Sale'] },
      { id: 'q2_1', type: 'toggle', label: 'Will existing tenants remain in occupation during works?' },
      { id: 'q2_2', type: 'toggle', label: 'Will residents require temporary relocation or decanting?', trigger: 'Decanting obligations require a Housing Decant Policy and Section 39 Housing Act duties.' },
      { id: 'q2_3', type: 'toggle', label: 'Will the programme affect leaseholder-owned properties?' },
      { id: 'q2_4', type: 'toggle', label: 'Will costs of works be recovered through service charges to leaseholders?', trigger: 'Section 20 consultation obligations apply for qualifying works above £250 per leaseholder.' },
      { id: 'q2_5', type: 'toggle', label: 'Will the programme involve supported housing or care accommodation?', trigger: 'Supported housing triggers CQC regulation and Care Act 2014 compliance considerations.' }
    ]
  },
  {
    id: 'prog_building', num: '03',
    title: 'Building Characteristics',
    hint: 'Determines Building Safety Act 2022 obligations and HRB classification.',
    questions: [
      { id: 'q3_1', type: 'toggle', label: 'Are any buildings expected to exceed 18 metres in height?', trigger: 'Buildings ≥18m are classified as Higher-Risk Buildings (HRBs) under the Building Safety Act 2022.' },
      { id: 'q3_2', type: 'toggle', label: 'Are any buildings expected to exceed 7 storeys?', trigger: 'Buildings >7 storeys are subject to BSA 2022 Gateway and Golden Thread requirements.' },
      { id: 'q3_3', type: 'toggle', label: 'Are the programme buildings primarily residential?' },
      { id: 'q3_4', type: 'toggle', label: 'Will the programme involve refurbishment of existing high-rise residential buildings?' },
      { id: 'q3_5', type: 'toggle', label: 'Will the programme include mixed-use buildings (residential + commercial)?' },
      { id: 'q3_6', type: 'toggle', label: 'Are buildings expected to remain occupied during major construction works?', trigger: 'Occupied buildings during works requires a Construction Phase Occupancy Risk Plan.' }
    ]
  },
  {
    id: 'prog_safety', num: '04',
    title: 'Building Safety Governance',
    hint: 'Determines HRB safety management, Gateway approvals and Golden Thread requirements.',
    questions: [
      { id: 'q4_1', type: 'toggle', label: 'Will the programme require Building Safety Regulator approval?', trigger: 'BSR approval is mandatory for all new HRB projects and major refurbishments.' },
      { id: 'q4_2', type: 'toggle', label: 'Will the programme require Gateway approvals under the Building Safety Act?', trigger: 'Gateway 2 and 3 approvals must be obtained before construction and occupation respectively.' },
      { id: 'q4_3', type: 'toggle', label: 'Will a digital "Golden Thread" of building safety information be required?', trigger: 'Golden Thread is mandatory for all HRBs — structured, version-controlled safety documentation.' },
      { id: 'q4_4', type: 'toggle', label: 'Will an Accountable Person or Building Safety Manager need to be appointed?', trigger: 'Accountable Person appointment is a statutory duty under BSA 2022 for occupied HRBs.' }
    ]
  },
  {
    id: 'prog_construction', num: '05',
    title: 'Construction & Site Works',
    hint: 'Determines CDM 2015 duties, HSE notification and hazardous materials obligations.',
    questions: [
      { id: 'q5_1', type: 'toggle', label: 'Will the programme involve construction works?' },
      { id: 'q5_2', type: 'toggle', label: 'Will multiple contractors operate across programme projects?', trigger: 'Multiple contractors require appointment of Principal Contractor under CDM 2015.' },
      { id: 'q5_3', type: 'toggle', label: 'Will the programme involve demolition of existing buildings?', trigger: 'Demolition triggers HSE F10 notification and pre-demolition structural survey requirements.' },
      { id: 'q5_4', type: 'toggle', label: 'Will the programme involve structural alterations to existing buildings?' },
      { id: 'q5_5', type: 'toggle', label: 'Will the programme involve hazardous material remediation (e.g., asbestos)?', trigger: 'Asbestos works require a licensed contractor, management survey, and HSE notification.' },
      { id: 'q5_6', type: 'toggle', label: 'Will the programme require appointment of a Principal Designer and Principal Contractor?', trigger: 'CDM 2015 requires Principal Designer appointment where more than one contractor is involved.' }
    ]
  },
  {
    id: 'prog_procurement', num: '06',
    title: 'Procurement & Contracting',
    hint: 'Determines public procurement legislation obligations and framework compliance.',
    questions: [
      { id: 'q6_1', type: 'toggle', label: 'Will construction contracts be procured by a public authority?', trigger: 'Public authority procurement is subject to the Procurement Act 2023 (effective February 2025).' },
      { id: 'q6_2', type: 'toggle', label: 'Will procurement follow public procurement legislation?', trigger: 'Contracts above threshold must follow competitive tendering rules.' },
      { id: 'q6_3', type: 'toggle', label: 'Will the programme use framework agreements or delivery partnerships?' },
      { id: 'q6_4', type: 'toggle', label: 'Will contracts be procured individually per project or as programme packages?' },
      { id: 'q6_5', type: 'toggle', label: 'Will the programme involve joint venture or development partners?', trigger: 'JV structures may require additional governance, SPV setup and legal due diligence.' }
    ]
  },
  {
    id: 'prog_planning', num: '07',
    title: 'Planning & Development',
    hint: 'Determines planning legislation and development control requirements.',
    questions: [
      { id: 'q7_1', type: 'toggle', label: 'Will the programme require planning permission for new development?' },
      { id: 'q7_2', type: 'toggle', label: 'Will any sites fall within conservation areas or heritage zones?', trigger: 'Conservation areas require additional heritage impact assessments and consent conditions.' },
      { id: 'q7_3', type: 'toggle', label: 'Will the programme involve listed buildings?', trigger: 'Listed buildings require Listed Building Consent for any alterations affecting character.' },
      { id: 'q7_4', type: 'toggle', label: 'Will development involve change of land use?' }
    ]
  },
  {
    id: 'prog_environment', num: '08',
    title: 'Environmental & Sustainability Compliance',
    hint: 'Determines environmental regulation, flood risk and biodiversity net gain obligations.',
    questions: [
      { id: 'q8_1', type: 'toggle', label: 'Are any programme sites located on brownfield or previously developed land?' },
      { id: 'q8_2', type: 'toggle', label: 'Are any sites located in flood risk zones?', trigger: 'Flood risk zones require a Flood Risk Assessment and Sequential Test before planning.' },
      { id: 'q8_3', type: 'toggle', label: 'Will development require environmental impact assessments?', trigger: 'EIA required for Schedule 1/2 development under the Town & Country Planning (EIA) Regulations 2017.' },
      { id: 'q8_4', type: 'toggle', label: 'Will the programme involve decarbonisation or energy efficiency upgrades?' },
      { id: 'q8_5', type: 'toggle', label: 'Will the programme require biodiversity net gain compliance?', trigger: 'Biodiversity Net Gain (10% minimum) is mandatory for planning permissions in England from February 2024.' }
    ]
  },
  {
    id: 'prog_residents', num: '09',
    title: 'Resident & Community Impact',
    hint: 'Determines consultation obligations, equality duties and party wall requirements.',
    questions: [
      { id: 'q9_1', type: 'toggle', label: 'Will the programme require resident consultation processes?', trigger: 'Resident consultation required under RSH Consumer Standards and Housing Act 1985.' },
      { id: 'q9_2', type: 'toggle', label: 'Will works impact vulnerable residents or protected groups?', trigger: 'Works affecting protected groups trigger PSED obligations under Equality Act 2010.' },
      { id: 'q9_3', type: 'toggle', label: 'Will an Equality Impact Assessment (EqIA) be required?', trigger: 'EqIA required where decisions may disproportionately affect groups with protected characteristics.' },
      { id: 'q9_4', type: 'toggle', label: 'Will works affect shared or neighbouring structures (party walls)?', trigger: 'Party Wall Act 1996 notices must be served to adjoining owners at least 2 months before works.' }
    ]
  },
  {
    id: 'prog_information', num: '10',
    title: 'Information Governance & Transparency',
    hint: 'Determines FOI obligations and compliance documentation requirements.',
    questions: [
      { id: 'q10_1', type: 'toggle', label: 'Is the programme delivered by a public authority subject to FOI legislation?', trigger: 'FOI obligations require publication schemes and response procedures for information requests.' },
      { id: 'q10_2', type: 'toggle', label: 'Will the programme require formal compliance documentation and regulatory reporting?', trigger: 'Formal compliance docs include Construction Phase Plans, Building Safety Cases and RSH returns.' }
    ]
  }
];

export const PROJECT_PHASES: QuestionPhase[] = [
  {
    id: 'proj_scope', num: '01',
    title: 'Project Scope & Delivery Context',
    hint: 'Establishes the nature, scale and delivery mechanism of the project.',
    questions: [
      { id: 'p1_type', type: 'select', label: 'What best describes this project?', options: ['New build residential construction', 'Refurbishment of existing housing stock', 'Demolition and rebuild', 'Structural extension or alteration', 'Decarbonisation / energy efficiency retrofit', 'Cladding remediation', 'Internal fit-out or communal works only', 'Estate infrastructure works'] },
      { id: 'p1_client', type: 'select', label: 'Who is the client organisation?', options: ['Local Authority', 'Registered Provider / Housing Association', 'Private Developer', 'Joint Venture / Special Purpose Vehicle', 'Other public body'] },
      { id: 'p1_units', type: 'select', label: 'How many residential units does the project affect?', options: ['1–10 units', '11–50 units', '51–100 units', '101–250 units', '251–500 units', '500+ units'] },
      { id: 'p1_value', type: 'select', label: 'What is the estimated contract value?', options: ['Under £50,000', '£50,000–£250,000', '£250,000–£1 million', '£1m–£5 million', '£5m–£20 million', 'Over £20 million'] },
      { id: 'p1_occupied', type: 'toggle', label: 'Will the building(s) be occupied during construction / works?', trigger: 'Occupied works require an Occupancy Risk Plan, welfare segregation and resident notification protocols.' },
      { id: 'p1_phased', type: 'toggle', label: 'Will the project be delivered in phases or multiple stages?' },
      { id: 'p1_land', type: 'toggle', label: 'Does the project involve any land assembly or CPO?' }
    ]
  },
  {
    id: 'proj_building', num: '02',
    title: 'Building Characteristics',
    hint: 'Determines Higher-Risk Building (HRB) classification and structural obligations.',
    questions: [
      { id: 'p2_height', type: 'select', label: 'What is the height of the building(s)?', options: ['Under 11 metres', '11–18 metres', '18–30 metres', '30–50 metres', 'Over 50 metres'] },
      { id: 'p2_storeys', type: 'select', label: 'How many storeys does the tallest building have?', options: ['1–2 storeys', '3–6 storeys', '7 storeys', '8–15 storeys', '16–30 storeys', '30+ storeys'] },
      { id: 'p2_use', type: 'multi', label: 'What is the primary use classification of the building(s)?', options: ['Residential — general needs', 'Residential — sheltered / later living', 'Supported / care housing', 'Mixed-use (residential + commercial)', 'Student accommodation', 'Hotel / short-stay', 'Commercial / office only'] },
      { id: 'p2_hrb', type: 'toggle', label: 'Has the building been formally classified as a Higher-Risk Building (HRB)?', trigger: 'Formal HRB classification requires registration with the Building Safety Regulator and full Gateway compliance.' },
      { id: 'p2_listed', type: 'toggle', label: 'Is the building a listed structure?', trigger: 'Listed Building Consent is required from the Local Planning Authority for any works affecting its character.' },
      { id: 'p2_conservation', type: 'toggle', label: 'Is the building located in a conservation area?', trigger: 'Conservation area location requires additional heritage impact assessment and may restrict permitted development.' },
      { id: 'p2_cladding', type: 'toggle', label: 'Does the building have existing cladding systems to be replaced or remediated?', trigger: 'Cladding remediation on buildings ≥11m may engage the Building Safety Fund and requires a cladding remediation plan.' },
      { id: 'p2_lifts', type: 'toggle', label: 'Are there any existing passenger lifts?' }
    ]
  },
  {
    id: 'proj_hrb', num: '03',
    title: 'Building Safety Act Compliance',
    hint: 'Determines BSA 2022 Gateway regime, Golden Thread and statutory duty holder requirements.',
    questions: [
      { id: 'p3_g2', type: 'toggle', label: 'Will the project require Gateway 2 approval before construction commences?', trigger: 'Gateway 2 approval from the Building Safety Regulator is mandatory for all new HRBs before works begin.' },
      { id: 'p3_g3', type: 'toggle', label: 'Will the project require Gateway 3 approval before occupation?', trigger: 'Gateway 3 (completion certificate) is required from the BSR before any HRB can be occupied.' },
      { id: 'p3_golden', type: 'toggle', label: 'Will a Golden Thread of building safety information need to be established?', trigger: 'The Golden Thread must be digital, version-controlled and maintained throughout the building lifecycle.' },
      { id: 'p3_ap', type: 'toggle', label: 'Will an Accountable Person (AP) need to be appointed or confirmed?', trigger: 'The AP holds statutory responsibility for safety in occupied HRBs under BSA 2022 Section 72.' },
      { id: 'p3_bsm', type: 'toggle', label: 'Will a Building Safety Manager (BSM) need to be appointed?', trigger: 'The BSM is appointed by the AP to manage day-to-day building safety and resident engagement.' },
      { id: 'p3_safety_case', type: 'toggle', label: 'Will a Building Safety Case and Safety Case Report be required?', trigger: 'A Safety Case Report must be submitted to the BSR and updated at registration renewal.' },
      { id: 'p3_residents', type: 'toggle', label: 'Will a Residents Engagement Strategy be required under BSA 2022?', trigger: 'Registered HRBs must have a documented strategy for engaging residents on building safety matters.' }
    ]
  },
  {
    id: 'proj_cdm', num: '04',
    title: 'Construction & CDM Duties',
    hint: 'Determines CDM 2015 duty holder appointments, HSE notifications and site safety obligations.',
    questions: [
      { id: 'p4_notifiable', type: 'toggle', label: 'Is the project notifiable to the HSE under CDM 2015?', trigger: 'Projects lasting more than 30 working days with 20+ simultaneous workers, or 500+ person-days, must be notified via F10.' },
      { id: 'p4_pd', type: 'toggle', label: 'Has a Principal Designer been appointed for this project?', trigger: 'Principal Designer appointment is mandatory under CDM 2015 where more than one contractor is involved.' },
      { id: 'p4_pc', type: 'toggle', label: 'Has a Principal Contractor been appointed?', trigger: 'The Principal Contractor must produce the Construction Phase Plan and manage site safety.' },
      { id: 'p4_cpp', type: 'toggle', label: 'Has a Construction Phase Plan been prepared?', trigger: 'The CPP must be prepared by the Principal Contractor before construction commences.' },
      { id: 'p4_demolition', type: 'toggle', label: 'Will the project involve any demolition works?', trigger: 'Demolition requires pre-demolition structural survey, hazardous materials assessment and HSE notification.' },
      { id: 'p4_structural', type: 'toggle', label: 'Will the project involve structural alterations to existing fabric?' },
      { id: 'p4_hazmat', type: 'toggle', label: 'Has a hazardous materials survey (asbestos, lead) been carried out?', trigger: 'Asbestos survey required before any works on buildings constructed before 2000. Licensed contractor required for licensable works.' },
      { id: 'p4_temporary', type: 'toggle', label: 'Will temporary works (scaffolding, propping, shoring) be required?', trigger: 'Significant temporary works require a Temporary Works Coordinator and formal design approval.' }
    ]
  },
  {
    id: 'proj_residents', num: '05',
    title: 'Residents, Leaseholders & Decant',
    hint: 'Determines resident rights, Section 20 consultation and decant obligations.',
    questions: [
      { id: 'p5_s20', type: 'toggle', label: 'Will service charges be levied on leaseholders to recover works costs?', trigger: 'Qualifying works above £250 per leaseholder require Section 20 consultation under the Landlord and Tenant Act 1985.' },
      { id: 'p5_decant', type: 'toggle', label: 'Will any residents need to be temporarily decanted during works?', trigger: 'Decanting requires individual decant agreements, like-for-like accommodation and an approved Decant Policy.' },
      { id: 'p5_vulnerable', type: 'toggle', label: 'Are any residents in the works area classified as vulnerable or having protected characteristics?', trigger: 'Equality Act 2010 PSED obligations apply. An Equality Impact Assessment may be required.' },
      { id: 'p5_supported', type: 'toggle', label: 'Is the building supported housing or registered care accommodation?', trigger: 'CQC registration and Care Act 2014 obligations apply to works on registered care premises.' },
      { id: 'p5_consultation', type: 'toggle', label: 'Will a formal resident consultation process be required before works commence?', trigger: 'RSH Consumer Standards require meaningful consultation. Resident Liaison Officer appointment recommended.' },
      { id: 'p5_party_wall', type: 'toggle', label: 'Will works affect any party walls or shared structures with neighbouring properties?', trigger: 'Party Wall etc. Act 1996 notices must be served at least 2 months before commencement. Surveyor appointment may follow.' }
    ]
  },
  {
    id: 'proj_decarbonisation', num: '06',
    title: 'Decarbonisation & Retrofit',
    hint: 'Determines SHDF grant obligations, EPC requirements and energy efficiency compliance.',
    questions: [
      { id: 'p6_shdf', type: 'toggle', label: 'Is the project funded through the Social Housing Decarbonisation Fund (SHDF)?', trigger: 'SHDF funding requires whole-house approach delivery, PAS 2035 compliance and post-works EPC validation.' },
      { id: 'p6_pas', type: 'toggle', label: 'Will the project need to comply with PAS 2035 (Retrofit Standard)?', trigger: 'PAS 2035 requires appointment of a Retrofit Coordinator and Assessor before works commence.' },
      { id: 'p6_epc', type: 'select', label: 'What is the current EPC rating of the properties in scope?', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'Mixed / unknown'] },
      { id: 'p6_target_epc', type: 'select', label: 'What is the target EPC rating post-works?', options: ['A', 'B', 'C', 'D', 'Not applicable'] },
      { id: 'p6_measures', type: 'multi', label: 'Which retrofit measures are included in the project scope?', options: ['External wall insulation', 'Internal wall insulation', 'Loft / roof insulation', 'Heat pump installation', 'Solar PV', 'Ventilation (MVHR)', 'Windows / doors replacement', 'Heating controls', 'Hot water cylinder upgrade'] },
      { id: 'p6_moisture', type: 'toggle', label: 'Has a pre-works moisture / damp and mould risk assessment been carried out?', trigger: 'Pre-works risk assessment is required to prevent retrofit causing condensation or moisture issues (Awaab\'s Law awareness).' },
      { id: 'p6_pv', type: 'toggle', label: 'Will solar PV or battery storage systems be installed?', trigger: 'Grid connection notification to DNO required. G98/G99 applications may apply. MCS certification of installer required.' }
    ]
  },
  {
    id: 'proj_procurement', num: '07',
    title: 'Contract & Procurement',
    hint: 'Determines procurement route, threshold obligations and contract governance.',
    questions: [
      { id: 'p7_route', type: 'select', label: 'What procurement route is being used for this project?', options: ['Open procedure', 'Restricted procedure', 'Competitive dialogue', 'Direct award (framework call-off)', 'Direct award (waiver)', 'Design and build', 'Traditional (separate design)', 'Two-stage tender'] },
      { id: 'p7_framework', type: 'toggle', label: 'Is the contract being called off from an existing framework agreement?' },
      { id: 'p7_threshold', type: 'toggle', label: 'Does the contract value exceed the Procurement Act 2023 works threshold (£5.372m)?', trigger: 'Contracts above threshold require FIND/transparency notices and full procurement compliance under the Procurement Act 2023.' },
      { id: 'p7_jv', type: 'toggle', label: 'Does the project involve a joint venture, SPV or development partner?', trigger: 'JV structures require governance agreements, SPV setup documentation and legal sign-off before contract award.' },
      { id: 'p7_form', type: 'select', label: 'What contract form is being used?', options: ['JCT Standard Building Contract', 'JCT Design and Build', 'NEC4 ECC', 'NEC4 PSC', 'PCSA', 'Other bespoke form', 'Not yet determined'] },
      { id: 'p7_bond', type: 'toggle', label: 'Will a performance bond or parent company guarantee be required?', trigger: 'Bonds and guarantees must be in place before contract commencement. Require specialist legal review.' },
      { id: 'p7_sv', type: 'toggle', label: 'Does the contract include social value requirements?', trigger: 'Social value commitments must be measurable and reported. Align with the Social Value Act 2012 and SHDF requirements where applicable.' }
    ]
  },
  {
    id: 'proj_planning', num: '08',
    title: 'Planning & Development',
    hint: 'Determines planning permission requirements, heritage constraints and development controls.',
    questions: [
      { id: 'p8_pp', type: 'toggle', label: 'Does the project require full planning permission?', trigger: 'Full planning permission required before any material operations commence on site.' },
      { id: 'p8_pd', type: 'toggle', label: 'Will works be carried out under permitted development rights?', trigger: 'Confirm PD rights apply. A Lawful Development Certificate may be advisable to evidence compliance.' },
      { id: 'p8_change_use', type: 'toggle', label: 'Does the project involve a change of land use?', trigger: 'Change of use requires a formal planning application and may trigger S106/CIL obligations.' },
      { id: 'p8_s106', type: 'toggle', label: 'Will the project trigger a Section 106 agreement or CIL liability?', trigger: 'S106 heads of terms must be agreed with the LPA before planning permission is granted.' },
      { id: 'p8_bng', type: 'toggle', label: 'Will the project require Biodiversity Net Gain (BNG) compliance?', trigger: 'Mandatory 10% BNG applies to planning permissions in England from February 2024. A Biodiversity Metric assessment is required.' },
      { id: 'p8_flood', type: 'toggle', label: 'Is the site located in a flood risk zone (Zone 2 or 3)?', trigger: 'Flood Risk Assessment and Sequential Test required before planning application is submitted.' },
      { id: 'p8_eia', type: 'toggle', label: 'Is an Environmental Impact Assessment (EIA) required or likely?', trigger: 'EIA is required for Schedule 1/2 development under the T&CP (EIA) Regulations 2017.' }
    ]
  },
  {
    id: 'proj_environment', num: '09',
    title: 'Environmental & Site Constraints',
    hint: 'Determines ground conditions, contamination, ecology and environmental permitting obligations.',
    questions: [
      { id: 'p9_brownfield', type: 'toggle', label: 'Is the site brownfield or previously developed land?' },
      { id: 'p9_contamination', type: 'toggle', label: 'Is the site known to be contaminated or are investigations outstanding?', trigger: 'Contaminated land requires Phase 1 / Phase 2 Environmental Site Investigation and a Remediation Strategy.' },
      { id: 'p9_ecology', type: 'toggle', label: 'Are there protected species or habitats on or adjacent to the site?', trigger: 'Protected species survey and Ecological Impact Assessment required before works. Natural England licensing may apply.' },
      { id: 'p9_trees', type: 'toggle', label: 'Are there protected trees (TPO) or trees in a conservation area on or adjacent to the site?', trigger: 'Works to TPO trees require LPA consent. Arboricultural Impact Assessment and Method Statement needed.' },
      { id: 'p9_groundwater', type: 'toggle', label: 'Are there any groundwater or drainage constraints on the site?', trigger: 'Sustainable Urban Drainage System (SuDS) approval required from Lead Local Flood Authority for new drainage systems.' },
      { id: 'p9_noise', type: 'toggle', label: 'Will construction activities generate significant noise or vibration impacts?', trigger: 'Noise/vibration mitigation plan required. Prior consent under Section 61 COPA 1974 recommended.' },
      { id: 'p9_utilities', type: 'toggle', label: 'Are there any known utility capacity issues?' }
    ]
  },
  {
    id: 'proj_health', num: '10',
    title: 'Health, Safety & Welfare',
    hint: 'Determines site welfare obligations, fire safety management and emergency planning requirements.',
    questions: [
      { id: 'p10_welfare', type: 'toggle', label: 'Have site welfare facilities been provided in accordance with CDM 2015 Schedule 2?', trigger: 'Minimum welfare standards must be in place before works commence: toilets, washing, rest, changing, drinking water.' },
      { id: 'p10_fire', type: 'toggle', label: 'Will fire safety management during works require a specific fire strategy or interim measures?', trigger: 'Occupied buildings under refurbishment require an Interim Fire Risk Management Plan and waking watch assessment.' },
      { id: 'p10_emergency', type: 'toggle', label: 'Will an emergency plan and site evacuation procedures be required?', trigger: 'Construction Phase Plan must include emergency arrangements. Evacuation drill required for occupied sites.' },
      { id: 'p10_traffic', type: 'toggle', label: 'Will the project require a construction traffic management plan?', trigger: 'CTMP required where construction vehicles will significantly affect public roads or pedestrian routes.' },
      { id: 'p10_safe_systems', type: 'toggle', label: 'Are there any specific safe systems of work required (e.g., working at height, confined spaces, hot works)?', trigger: 'Permit-to-work systems and method statements required for high-risk activities under the Health & Safety at Work Act.' },
      { id: 'p10_insurance', type: 'toggle', label: 'Has contractor insurance (employers liability, public liability, professional indemnity) been confirmed?', trigger: 'Minimum insurance levels must be confirmed and evidenced before contract commencement.' }
    ]
  }
];
