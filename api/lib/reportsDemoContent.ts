// Demo Tiptap-JSON content for one fully-populated seed report so the
// editor lands with realistic Cabinet-paper content instead of empty
// sections. Wired into instantiateSectionsIfMissing — when a seeded
// section's id matches a key in DEMO_CONTENT[reportId], that JSON is
// used as the section's initial content.
//
// Currently populates: rpt-approved-aspen (KM4 mid-stage milestone for
// the Aspen Court refurbishment).

// ───── Tiptap JSON helpers ──────────────────────────────────────────────

type Node = Record<string, any>;

const text = (s: string, marks?: Array<{ type: string }>): Node => ({
  type: 'text',
  text: s,
  ...(marks ? { marks } : {}),
});

const bold = (s: string): Node =>
  text(s, [{ type: 'bold' }]);

const p = (...kids: Node[]): Node => ({
  type: 'paragraph',
  content: kids.length ? kids : [{ type: 'text', text: '' }],
});

const h = (level: 2 | 3, t: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [text(t)],
});

const ol = (items: string[]): Node => ({
  type: 'orderedList',
  content: items.map((t) => ({
    type: 'listItem',
    content: [p(text(t))],
  })),
});

const ul = (items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((t) => ({
    type: 'listItem',
    content: [p(text(t))],
  })),
});

const cell = (raw: string, isHeader = false): Node => ({
  type: isHeader ? 'tableHeader' : 'tableCell',
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [p(text(raw))],
});

const row = (cells: Node[]): Node => ({ type: 'tableRow', content: cells });

const table = (header: string[], rows: string[][]): Node => ({
  type: 'table',
  content: [
    row(header.map((h) => cell(h, true))),
    ...rows.map((r) => row(r.map((c) => cell(c)))),
  ],
});

const doc = (...nodes: Node[]): Node => ({ type: 'doc', content: nodes });

// ───── Aspen Court — KM4 mid-stage milestone content ─────────────────────

const aspenHeader = doc(
  table(
    ['Field', 'Value'],
    [
      ['Decision taker', 'Cabinet Member · Housing'],
      ['Date', '22 April 2026'],
      ['Report title', 'Aspen Court refurbishment — KM4 mid-stage milestone report'],
      ['Wards', 'Walworth'],
      ['Classification', 'Open'],
      ['Reason for lateness', 'Not applicable'],
      ['From', 'Strategic Director — Housing'],
    ],
  ),
);

const aspenRecommendations = doc(
  p(
    text(
      'The Cabinet Member is asked to note progress on the Aspen Court refurbishment programme and approve the recommendations set out below.',
    ),
  ),
  ol([
    'Note that the contract award to Galliford Try Construction Ltd was confirmed on 14 March 2026 with a contract sum of £8,415,200.',
    'Approve the variation budget of £342,000 to cover the additional asbestos removal works identified in survey 04-2026 (paragraph 27).',
    'Approve the revised tenant decant programme as set out in Appendix 2, taking account of resident consultation feedback received Jan–Mar 2026.',
    'Note the updated risk register and the mitigations set out in section 7 of this report.',
    'Authorise the Strategic Director — Housing to take all subsequent operational decisions within the approved envelope.',
  ]),
);

const aspenBackground = doc(
  p(
    text(
      'Aspen Court is a 92-unit residential block on the Walworth estate, originally constructed in 1972. The Phase 2 refurbishment programme was approved by Cabinet on 18 September 2025 (Gateway 2 — paper CAB/2025/142) with a total approved budget of £8.6m and a delivery window of 24 months.',
    ),
  ),
  p(
    text(
      'This Key Milestone (KM4) report covers the period from contract award (March 2026) through to mobilisation completion (April 2026). It updates the Cabinet Member on procurement outcome, baseline programme, and material changes to risk and budget since the GW2 paper.',
    ),
  ),
  h(3, 'Procurement outcome'),
  p(
    text(
      'A two-stage restricted procurement was run from October 2025 through to February 2026 under the Council\'s Construction & Refurbishment Framework Lot 2 (refurbishment > £5m). Of seven framework contractors invited, four returned compliant tenders.',
    ),
  ),
  p(
    text(
      'Tender evaluation was scored 60% quality / 40% price. Galliford Try Construction Ltd ranked highest on combined score (87.4 / 100) and was therefore the recommended bidder. Their bid sum of £8,415,200 fell £184,800 below the GW2-approved budget envelope.',
    ),
  ),
  h(3, 'Resident consultation'),
  p(
    text(
      'Residents were consulted on the decant programme through three structured workshops in January and February 2026, an estate-wide drop-in surgery on 8 March, and a written consultation that closed 21 March 2026. Headline themes:',
    ),
  ),
  ul([
    'Strong support for the proposed phased decant approach (74% in favour) over a single full-block decant.',
    'Concern about temporary accommodation quality — addressed by upgrading the temporary unit specification to match the refurbished standard.',
    'Request for weekly progress newsletters during works — accepted; first newsletter issued 1 April 2026.',
  ]),
);

const aspenFinancial = doc(
  p(
    bold('Capital cost summary'),
  ),
  table(
    ['Item', 'GW2 budget (£)', 'Tender outcome (£)', 'Variance (£)'],
    [
      ['Construction (main contractor)', '8,600,000', '8,415,200', '-184,800'],
      ['Decant costs', '420,000', '470,000', '+50,000'],
      ['Asbestos contingency', '120,000', '462,000', '+342,000'],
      ['Professional fees', '510,000', '510,000', '0'],
      ['Contingency (5%)', '430,000', '430,000', '0'],
      ['Total', '10,080,000', '10,287,200', '+207,200'],
    ],
  ),
  p(),
  p(
    text(
      'The £207,200 net overrun is recommended for approval by drawing on the HRA capital programme contingency line for 2026/27 (£12.4m available). This is within the Cabinet Member\'s delegated authority for in-flight schemes.',
    ),
  ),
  h(3, 'Section 151 Officer comment'),
  p(
    text(
      'I am satisfied that the proposed funding route is sound and that the variance is contained within the approved HRA capital programme contingency. The asbestos cost increase is supported by intrusive survey evidence and represents necessary safety expenditure. — N. Jenkinson, Section 151 Officer, 18 April 2026.',
    ),
  ),
);

const aspenLegal = doc(
  p(
    text(
      'The contract has been let under the JCT Standard Building Contract 2016 with Quantities, with bespoke amendments approved by the Council\'s Procurement & Contracts team (reference PROC-2026-0084). All amendments are within the Council\'s standard schedule of approved deviations from the JCT base form.',
    ),
  ),
  p(
    text(
      'The procurement complied with the Public Procurement Act 2023 transitional provisions, the Council\'s Contract Standing Orders, and the Construction & Refurbishment Framework call-off rules. No legal challenges were received during the standstill period.',
    ),
  ),
  h(3, 'Monitoring Officer comment'),
  p(
    text(
      'I confirm that the procurement process has been carried out in accordance with the Public Procurement Act 2023, the Council\'s Contract Standing Orders, and applicable framework call-off provisions. The recommendation to approve the additional £342,000 asbestos contingency is within the scope of the approved Gateway 2 envelope when the unspent main contract budget is taken into account. — A. Patel, Monitoring Officer, 17 April 2026.',
    ),
  ),
);

const aspenCommunity = doc(
  p(
    text(
      'An updated Equalities Impact Assessment (ENIA) has been completed and is attached as Appendix 3. The headline findings are:',
    ),
  ),
  ul([
    'Positive impact: improved thermal comfort + EPC C uplift across all 92 flats benefits older residents and households on lower incomes (38% of the block).',
    'Mitigated negative impact: 6-week decant period for each flat could disadvantage residents with mobility impairments — mitigated by like-for-like accessible temporary units within 0.4 miles of the existing block.',
    'No identified adverse impact on residents with protected characteristics under the Equality Act 2010.',
  ]),
  p(
    text(
      'A community liaison officer is in place for the duration of the contract to handle complaints, language-support requests, and accessibility needs.',
    ),
  ),
);

const aspenRisk = doc(
  p(
    text(
      'The risk register has been updated since the GW2 paper. The five highest-rated residual risks are summarised below.',
    ),
  ),
  table(
    ['Ref', 'Risk', 'Rating', 'Mitigation'],
    [
      [
        'R-01',
        'Asbestos beyond the surveyed extent encountered during strip-out',
        'High',
        'Independent re-survey by HSE-licensed surveyor scheduled for week 4. Contractor to hold weekly site reviews. £150k of the contingency ring-fenced.',
      ],
      [
        'R-02',
        'Decant unit availability slips during peak Q3 demand',
        'Medium',
        'Letter of intent signed with Notting Hill Genesis covering 12 backup units within 1 mile. Lead-in confirmed at 21 days.',
      ],
      [
        'R-03',
        'Scope creep from resident-led design changes',
        'Medium',
        'Strict change-control protocol agreed with the residents\' association. All changes routed through a monthly tenant board.',
      ],
      [
        'R-04',
        'Adverse weather delays during external envelope works',
        'Medium',
        'Programme has 8 weeks of weather contingency built in for Q4 2026 / Q1 2027 sequencing.',
      ],
      [
        'R-05',
        'Construction-cost inflation on PC sums',
        'Low',
        'PC sums fixed at tender; only Type-A inflation indexation applies for non-fixed elements.',
      ],
    ],
  ),
);

const aspenConclusion = doc(
  p(
    text(
      'Contract award has been completed within budget, with a single recommended variation to the asbestos contingency that remains comfortably within the approved Gateway 2 envelope. Residents have been engaged extensively and the decant programme has been adjusted in response to consultation feedback.',
    ),
  ),
  p(
    text(
      'The risk profile is well understood, mitigations are in place, and the contracted programme aligns with the approved 24-month delivery window. Approval of the recommendations set out in section 2 will allow works to proceed on schedule with first decants commencing 6 May 2026.',
    ),
  ),
);

const aspenBackgroundDocs = doc(
  p(text('Prior reports referenced in this paper:')),
  ul([
    'CAB/2025/142 — Aspen Court refurbishment Gateway 2 contract recommendation (Cabinet, 18 September 2025).',
    'DPB/2025/091 — Aspen Court Gateway 1 strategic outline case (Departmental Programme Board, 14 May 2025).',
    'PROC-2026-0084 — Procurement & Contracts approval of JCT bespoke amendments (8 February 2026).',
    'SHL/2025/008 — HRA capital programme 2025/26 — 2027/28 (Cabinet, 21 July 2025).',
  ]),
);

const aspenAppendices = doc(
  p(text('Appendices to this report:')),
  ul([
    'Appendix 1 — Tender evaluation summary (Open).',
    'Appendix 2 — Revised decant programme + resident consultation feedback (Open).',
    'Appendix 3 — Updated Equalities Impact Assessment (Open).',
    'Appendix 4 — Detailed cost breakdown by trade package (Closed — Part 2, commercially sensitive).',
    'Appendix 5 — Asbestos survey 04-2026 executive summary (Open).',
  ]),
);

const aspenPartA = doc(
  p(
    bold('Part A — Sign-off'),
  ),
  p(
    text(
      'Under the powers delegated to me through the Council\'s Scheme of Delegation, I have considered this report and approve the recommendations set out in section 2.',
    ),
  ),
  p(),
  p(text('Signed: ____________________________')),
  p(text('Name: Cllr. Sarah Whitcombe')),
  p(text('Designation: Cabinet Member for Housing')),
  p(text('Date: 22 April 2026')),
);

const aspenPartB = doc(
  p(
    bold('Part B — Conflicts of interest declaration'),
  ),
  p(
    text(
      'I confirm that I have no personal, financial, or pecuniary interest in the matters considered in this report, nor in the contractor recommended for award, beyond my role as the Cabinet Member with portfolio responsibility for housing.',
    ),
  ),
  p(),
  p(text('Signed: ____________________________')),
  p(text('Name: Cllr. Sarah Whitcombe')),
  p(text('Date: 22 April 2026')),
);

const aspenAuditFooter = doc(
  table(
    ['Field', 'Value'],
    [
      ['Lead Officer', 'M. Donnelly, Strategic Director — Housing'],
      ['Report Author', 'J. Adesanya, Programme Manager — Refurbishment'],
      ['Version', '1.4'],
      ['Dated', '22 April 2026'],
      ['Key Decision', 'No (within approved envelope)'],
      ['Consultation', 'Residents\' Association · Section 151 · Monitoring Officer · Procurement & Contracts'],
    ],
  ),
);

// ───── Public export ─────────────────────────────────────────────────────

export const DEMO_CONTENT: Record<string, Record<string, Node>> = {
  'rpt-approved-aspen': {
    header: aspenHeader,
    recommendations: aspenRecommendations,
    background: aspenBackground,
    financial: aspenFinancial,
    legal: aspenLegal,
    community: aspenCommunity,
    risk: aspenRisk,
    conclusion: aspenConclusion,
    'background-docs': aspenBackgroundDocs,
    appendices: aspenAppendices,
    'part-a': aspenPartA,
    'part-b': aspenPartB,
    'audit-footer': aspenAuditFooter,
  },
};

export function getDemoContentForSection(
  reportId: string,
  sectionId: string,
): Node | null {
  const reportContent = DEMO_CONTENT[reportId];
  if (!reportContent) return null;
  return reportContent[sectionId] ?? null;
}

// Word-count helper for the demo content so seeded sections show their
// status dot accurately on first render.
export function approxWordCount(node: Node): number {
  if (!node) return 0;
  let count = 0;
  if (node.type === 'text' && typeof node.text === 'string') {
    count += node.text.trim().split(/\s+/).filter(Boolean).length;
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      count += approxWordCount(child);
    }
  }
  return count;
}
