import { api } from "../lib/api";
import { KRI_LIST } from "../data/riskData";
import {
  STRATEGIC_CATEGORIES,
  OPERATIONAL_CATEGORY_NAMES,
  OPERATIONAL_WORKSTREAMS,
  getCategoryId,
  CategoryId,
  WorkstreamId,
} from "../data/riskTaxonomy";
import toast from "react-hot-toast";

export function handleAIError(err: any, context = "AI operation") {
  const msg: string = err?.message || String(err);

  if (err?.status === 429 || msg.includes("429") || msg.includes("quota")) {
    toast.error(
      "AI quota exceeded. Please wait 60 seconds or add your own Gemini API key in Profile Settings.",
      { duration: 8000 },
    );
  } else if (
    err?.status === 408 ||
    msg.includes("deadline") ||
    msg.includes("timeout")
  ) {
    toast.error("AI request timed out. Please try again.", { duration: 5000 });
  } else if (msg.includes("overloaded") || err?.status === 503) {
    toast.error(
      "Gemini is currently overloaded. Please try again in a few moments.",
      { duration: 5000 },
    );
  } else if (
    err?.status === 401 ||
    err?.status === 403 ||
    msg.includes("API_KEY") ||
    msg.toLowerCase().includes("api key") ||
    msg.toLowerCase().includes("unauthorized")
  ) {
    toast.error(
      "AI service authentication failed. Check your API key in Profile Settings.",
      { duration: 6000 },
    );
  } else if (
    msg.includes("fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("Failed to fetch")
  ) {
    toast.error("Network error. Please check your connection and try again.", {
      duration: 5000,
    });
  } else if (msg.includes("AI_PARSE_CRITICAL_FAILURE")) {
    toast.error(
      `${context} returned an unreadable response. Please try again.`,
      { duration: 5000 },
    );
  } else {
    toast.error(`${context} failed. Please try again.`, { duration: 4000 });
  }
}

export async function analyzeCompliance(projectInfo: any, allItems: any[]) {
  const safeItems = Array.isArray(allItems) ? allItems : [];
  const itemSummary = safeItems
    .map(
      (i) =>
        `${i.id}|${i.domain || "N/A"}|${i.reg || "N/A"}|${(i.req || "").slice(0, 300)}`,
    )
    .join("\n");

  let mappingDirectives = "";
  try {
    const res = await api.getSystemMappings();
    if (res.success && res.mappings) {
      mappingDirectives = res.mappings
        .map(
          (m: any) =>
            `DIRECTIVE: ${m.description}\nINSTRUCTION: ${m.directive}`,
        )
        .join("\n\n");
    }
  } catch (e) {
    console.warn("Failed to fetch system mappings for AI", e);
  }

  const prompt = `
You are a UK social housing and construction compliance expert with 30 years of experience. A project manager has completed a compliance profile questionnaire. Based on their answers, identify every applicable UK regulation, statutory obligation and compliance requirement for this project. Apply your full knowledge of UK housing, construction, building safety, planning, environmental, procurement and housing management law. Only include regulations genuinely triggered by the answers.

IMPORTANT CONTEXT: The project/programme profile is structured into 10 phases (Phase 1-10) mirroring official UK Building Safety and Housing Compliance templates.
Question IDs follow the format:
- 'q[PHASE]_[QUESTION]' for Programme Profilers (e.g., 'q1_1' is a Phase 1 question).
- 'p[PHASE]_[QUESTION]' for Project Profilers (e.g., 'p1_type' is a Phase 1 question).
You must interpret these answers in the context of:
- Phase 1: Context & Governance / Scope
- Phase 2: Building Characteristics & Safety

MANDATORY VERIFICATION WORKFLOW:
We are implementing a "Yes/No" verification workflow for your suggestions.
1. 'applicableIds': Use this for items that DEFINITELY apply based on the profile. These will be marked as 'Verified' automatically.
2. 'conditionalIds': Use this for items that MIGHT apply. For example, if the user mentions "potential development", include planning requirements here. These will be placed in a 'Pending' queue for the user to verify.
3. BE AGGRESSIVE with 'conditionalIds'. If there is any chance a regulation applies but it's not 100% certain from the answers, put it in 'conditionalIds' with a clear explanation in the 'condition' field.

EVALUATE ALL ITEMS: You must evaluate EVERY SINGLE compliance item provided in the list below. Return ALL applicable compliance requirements. Do not limit your output to a small number of items. If 40 items apply based on the UK law, return all 40 IDs in the 'applicableIds' array. Never limit your responses to just Health & Safety or Fire Safety.

PLANNING REQUIREMENT FILTERING:
The user has previously noted that sometimes 'Planning' requirements are triggered even when they shouldn't be (e.g., if they already have permissions).
YOU MUST PERFORM A TRIPLE-CHECK:
1. Identify potential requirements.
2. Interrogate each requirement against the project profile: "Does this SPECIFIC answer (e.g. No Planning needed or Works under Permitted Development) explicitly rule this out?"
3. Validate and exclude any false positives. DO NOT include Planning requirements in 'applicableIds' if the user has indicated they are not needed. If uncertain, put them in 'conditionalIds'.

For the risks and actions, you must be extremely detailed and address:
- WHAT: The specific requirement, risk, or action.
- WHO: The responsible party, stakeholder, or regulatory body.
- WHEN: The trigger point, deadline, or frequency.
- HOW: The method of implementation, mitigation, or verification.
- WHERE: The specific asset, project area, or process phase.
- WHY: The regulatory driver, financial impact, or safety consequence of non-compliance.

SYSTEM MAPPING DIRECTIVES (MUST FOLLOW):
${mappingDirectives || "None defined."}

PROJECT DETAILS:
${JSON.stringify(projectInfo, null, 2)}

COMPLIANCE ITEMS (id|domain|regulation|requirement):
${itemSummary}

OUTPUT STRUCTURE:
Your response must be valid JSON following the schema provided in the configuration.
Summarize the regulatory landscape highlighting the most critical obligations, authorities involved, and key risks.

MANDATORY IDENTIFICATION:
1. 'regulatoryAuthorities': You MUST identify and list specific regulatory bodies involved (e.g. Building Safety Regulator (BSR), Regulator of Social Housing (RSH), Local Authority Planning, HSE, EA, Fire & Rescue Service) based on the project profile. 
2. 'requiredApprovals': You MUST identify and list specific mandatory approvals, consents, or gateway milestones (e.g. Gateway 2 Approval, Planning Permission, Fire Statement, S106, Section 20 Notice, Building Control Approval) required for this project/programme.
3. COMPREHENSIVE COVERAGE: You MUST ensure every UK regulation triggered by the profile answers is included. Do not prioritize briefness over legal compliance. If a chosen area (e.g. Retrofit, Social Housing) is mentioned, map its specific legislative requirements fully.

FORMATTING (STRICT): ABSOLUTELY NO MARKDOWN. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL.
`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Executive summary of the regulatory landscape and primary obligations.",
        },
        applicableIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of compliance items that definitely apply.",
        },
        notApplicableIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of compliance items that definitely do not apply.",
        },
        conditionalIds: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              condition: {
                type: "string",
                description:
                  "Why this might apply and what information is missing.",
              },
            },
          },
        },
        regulatoryAuthorities: {
          type: "array",
          items: { type: "string" },
          description:
            "List of regulatory authorities involved (e.g., BSR, RSH, HSE, EA).",
        },
        criticalActions: {
          type: "array",
          items: { type: "string" },
          description:
            "Mandatory compliance actions that must be prioritised immediately.",
        },
        requiredApprovals: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific approvals or consents required (e.g., Gateway 2, S106, Planning).",
        },
        keyRisks: {
          type: "array",
          items: { type: "string" },
          description:
            "Primary regulatory and compliance risks identified based on the profile.",
        },
      },
      required: [
        "summary",
        "applicableIds",
        "notApplicableIds",
        "conditionalIds",
        "regulatoryAuthorities",
        "criticalActions",
        "requiredApprovals",
        "keyRisks",
      ],
    },
  };

  try {
    const res = await api.analyzeCompliance(prompt, config);
    if (!res.success) throw new Error(res.error || "Analysis failed");

    const result =
      res.result && typeof res.result === "object" ? res.result : {};
    return {
      summary: result.summary || "No summary provided.",
      applicableIds: Array.isArray(result.applicableIds)
        ? result.applicableIds
        : [],
      notApplicableIds: Array.isArray(result.notApplicableIds)
        ? result.notApplicableIds
        : [],
      conditionalIds: Array.isArray(result.conditionalIds)
        ? result.conditionalIds
        : [],
      regulatoryAuthorities: Array.isArray(result.regulatoryAuthorities)
        ? result.regulatoryAuthorities
        : [],
      criticalActions: Array.isArray(result.criticalActions)
        ? result.criticalActions
        : [],
      requiredApprovals: Array.isArray(result.requiredApprovals)
        ? result.requiredApprovals
        : [],
      keyRisks: Array.isArray(result.keyRisks) ? result.keyRisks : [],
    };
  } catch (err: any) {
    console.error("Compliance Analysis Error:", err);
    handleAIError(err, "Compliance analysis");
    throw err;
  }
}

export async function analyzeRisks(projectInfo: any, existingRisks: any[]) {
  const risksArray = Array.isArray(existingRisks) ? existingRisks : [];
  const existingRiskTitles = risksArray
    .map((r) => `${r.id}: ${r.title}`)
    .join("\n");

  let mappingDirectives = "";
  try {
    const res = await api.getSystemMappings();
    if (res.success && res.mappings) {
      mappingDirectives = res.mappings
        .map(
          (m: any) =>
            `DIRECTIVE: ${m.description}\nINSTRUCTION: ${m.directive}`,
        )
        .join("\n\n");
    }
  } catch (e) {
    console.warn("Failed to fetch system mappings for AI", e);
  }

  const prompt = `You are a UK social housing and construction risk expert with 30 years of experience in housing delivery, construction and programme management. A delivery manager has completed a project profile questionnaire. Based on their answers, identify every material risk this project carries across construction, safety, programme, financial, procurement, planning, resident, environmental and regulatory dimensions. Only include risks genuinely indicated by the answers. For each risk, identify the cause, consequence, and who owns it.

Ensure at least 10 highly specific, realistic risks are provided for a robust, production-grade assessment.
For every risk, you must be extremely detailed. Each risk description (desc) and rationale MUST be a clean, solid paragraph addressing:
- WHAT: The specific risk nature and volatility.
- WHO: The responsible party, stakeholder, or regulatory body.
- WHEN: The trigger point, deadline, or failure frequency.
- HOW: The method of mitigation, control implementation, or monitoring.
- WHERE: The specific asset, project area, or workstream involved.
- WHY: The regulatory driver, financial exposure (£), or safety consequence.

Ensure strict adherence to standard enterprise risk management terminology (e.g., ISO 31000, Orange Book). Do not use informal language or introductory phrases.

SYSTEM MAPPING DIRECTIVES (MUST FOLLOW):
${mappingDirectives || "None defined."}

ALLOWED CATEGORIES (MUST use exactly one of these for each risk):
${OPERATIONAL_CATEGORY_NAMES.map((c) => `- ${c}`).join("\n")}

ALLOWED WORKSTREAMS (MUST use exactly one of these for each risk):
${OPERATIONAL_WORKSTREAMS.map((w) => `- ${w}`).join("\n")}

PROFILE:
${JSON.stringify(projectInfo, null, 2)}

RISKS ALREADY IN REGISTER (do not duplicate these):
${existingRiskTitles || "None"}

ALLOWED KEY RISK INDICATORS (KRI):
- ${KRI_LIST.join("\n- ")}

Generate risks with precise descriptions. For each risk:
1. Provide a clear 'cause'.
2. Assess 'grossL' (Likelihood 1-5) and 'grossI' (Impact 1-5).
3. Assess 'residualL' and 'residualI' (Residual ratings).
4. FINANCIAL DATA (CRITICAL):
   - 'grossImpact': Estimate total financial exposure in GBP (£) if the risk occurs (e.g. 50000, 250000). Use realistic figures for UK housing/construction.
   - 'grossProb': Probability of occurrence (0.0 to 1.0).
   - 'residualImpact': Estimated exposure after controls (£).
   - 'residualProb': Probability after controls (0.0 to 1.0).
5. Identify a likely 'owner' (role).
6. Propose specific mitigating 'controls' and 'furtherAction'.
7. LINKED KRI (CRITICAL): Assign exactly one KRI from the ALLOWED KEY RISK INDICATORS list above to the 'kri' field. Use only the exact strings provided.
8. FACT-CHECKING: Cross-reference each suggested risk against UK building safety and housing regulations (e.g. BSA 2022, Fire Safety Act) to ensure specific relevance.
9. FORMATTING (STRICT): ABSOLUTELY NO MARKDOWN in any string field. No **bold**, no # headers, no _italics_, no \`code\`. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          desc: { type: "string" },
          cause: { type: "string" },
          category: { type: "string" },
          workstream: { type: "string" },
          kri: { type: "string" },
          grossL: { type: "number" },
          grossI: { type: "number" },
          residualL: { type: "number" },
          residualI: { type: "number" },
          response: { type: "string" },
          owner: { type: "string" },
          controls: { type: "string" },
          furtherAction: { type: "string" },
          appetite: { type: "string" },
          grossImpact: {
            type: "number",
            description: "Financial value in GBP (£)",
          },
          grossProb: {
            type: "number",
            description: "Probability between 0.0 and 1.0",
          },
          residualImpact: {
            type: "number",
            description: "Financial value in GBP (£)",
          },
          residualProb: {
            type: "number",
            description: "Probability between 0.0 and 1.0",
          },
          rationale: { type: "string" },
        },
        required: [
          "title",
          "desc",
          "cause",
          "grossL",
          "grossI",
          "grossImpact",
          "grossProb",
          "residualImpact",
          "residualProb",
        ],
      },
    },
  };

  try {
    const res = await api.analyzeRisks(prompt, config);
    if (!res.success) throw new Error(res.error || "Analysis failed");
    return Array.isArray(res.result) ? res.result : [];
  } catch (err: any) {
    console.error("Risk Analysis Error:", err);
    handleAIError(err, "Risk analysis");
    throw err;
  }
}

export async function analyzeStrategicRisks(programmeProfile: any) {
  let mappingDirectives = "";
  try {
    const res = await api.getSystemMappings();
    if (res.success && res.mappings) {
      mappingDirectives = res.mappings
        .map(
          (m: any) =>
            `DIRECTIVE: ${m.description}\nINSTRUCTION: ${m.directive}`,
        )
        .join("\n\n");
    }
  } catch (e) {
    console.warn("Failed to fetch system mappings for AI", e);
  }

  // Build category ID mapping for AI
  const categoryMapping = STRATEGIC_CATEGORIES.map(
    (c) => `${c.id}: "${c.name}"`,
  ).join("\n");

  const prompt = `SYSTEM ROLE
You are an AI Strategic Programme Risk Advisor specialising in UK housing, regeneration, construction, and infrastructure programmes.
Your role is to analyse programme profile data and identify potential strategic risks that could affect the successful delivery of the programme.
The programme information has been collected through a structured questionnaire covering governance, delivery capacity, planning, construction, stakeholder impact, funding, dependencies, and schedule pressures.
You must use this information to determine the key strategic risks associated with the programme.
Your analysis should follow programme risk management principles used in major infrastructure and housing programmes.

PROGRAMME RISK DOMAINS
Your analysis must consider risks across the following 12 strategic risk domains:
1. Governance & Decision-Making Risk
2. Programme Scale & Complexity Risk
3. Delivery Capacity Risk
4. Supply Chain & Market Risk
5. Land & Site Risk
6. Planning & Regulatory Risk
7. Environmental & Sustainability Risk
8. Resident & Stakeholder Impact Risk
9. Funding & Financial Risk
10. Dependent Project Risk
11. Schedule & Delivery Pressure Risk
12. Operational Readiness & Handover Risk

CATEGORY ID MAPPING - Use these exact categoryId values in your response:
${categoryMapping}

Workstream ID: ws-prog-strat (always use this for programme strategic risks)

SYSTEM MAPPING DIRECTIVES (MUST FOLLOW):
${mappingDirectives || "None defined."}

INPUT DATA:
${JSON.stringify(programmeProfile, null, 2)}

TASK:
1. Identify the top 12-15 strategic risks based on the questionnaire answers. It is CRITICAL that you provide a minimum of 12 risks.
2. Categorise each risk under one of the 12 Strategic Risk Domains using the exact categoryId from the mapping above.
3. For each risk, describe with extreme detail:
   - Risk Title: Concise and professional.
   - Context/Trigger: Detailed explanation of Why this is a risk and What answer triggered it.
   - Inherent Severity: High/Medium/Low.
   - Potential Impact: Strategic consequences identifying Who is affected and Where.
   - Mitigation Strategy: Detailed How, When and What actions are required to manage the risk.
   - Key Risk Indicator (KRI): How to monitor this risk quantitatively.
4. Ensure the combination of these fields addresses the WHAT, WHO, WHEN, HOW, WHERE, and WHY for each risk.
5. Provide a Strategic Summary of the programme's overall risk profile.
6. Identify the "Critical Success Factors" for risk management for this programme.

ALLOWED KEY RISK INDICATORS (KRI):
- ${KRI_LIST.join("\n- ")}
  
FORMATTING (STRICT):
1. ABSOLUTELY NO MARKDOWN in any string field. No **bold**, no # headers, no _italics_, no \`code\`.
2. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL (e.g., "ID: PROG-01").
3. Use the exact categoryId values provided in the CATEGORY ID MAPPING section.
4. Ensure every field is populated with professional, expert content.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        riskProfile: {
          type: "array",
          items: {
            type: "object",
            properties: {
              categoryId: {
                type: "string",
                enum: STRATEGIC_CATEGORIES.map((c) => c.id),
              },
              workstreamId: {
                type: "string",
                enum: ["ws-prog-strat"],
              },
              domain: { type: "string" },
              title: { type: "string" },
              trigger: { type: "string" },
              severity: { type: "string", enum: ["High", "Medium", "Low"] },
              impact: { type: "string" },
              mitigation: { type: "string" },
              kri: { type: "string" },
            },
            required: [
              "categoryId",
              "workstreamId",
              "domain",
              "title",
              "trigger",
              "severity",
              "impact",
              "mitigation",
              "kri",
            ],
          },
        },
        summary: {
          type: "object",
          properties: {
            overallRating: { type: "string" },
            executiveOverview: { type: "string" },
            criticalSuccessFactors: { type: "string" },
          },
          required: [
            "overallRating",
            "executiveOverview",
            "criticalSuccessFactors",
          ],
        },
        heatOverview: {
          type: "object",
          properties: {
            riskConcentration: { type: "string" },
            domainHeatMap: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  domain: { type: "string" },
                  score: { type: "number" },
                },
              },
            },
          },
          required: ["riskConcentration", "domainHeatMap"],
        },
      },
      required: ["riskProfile", "summary", "heatOverview"],
    },
  };

  try {
    const res = await api.analyzeRisks(prompt, config);
    if (!res.success) throw new Error(res.error || "Analysis failed");
    return res.result ?? null;
  } catch (err: any) {
    console.error("Strategic Risk Analysis Error:", err);
    handleAIError(err, "Strategic risk analysis");
    throw err;
  }
}

export async function analyzeControls(
  risks: any[],
  projectContext?: any,
  projectInfo?: any,
) {
  if (risks.length === 0) return [];

  const risksArray = Array.isArray(risks) ? risks : [];

  // Build a concise project context line so AI knows the sector, type and stage
  const projectLine = projectContext
    ? [
        projectContext.name && `Project: ${projectContext.name}`,
        (projectContext.type || projectInfo?.type) &&
          `Type: ${projectContext.type || projectInfo?.type}`,
        (projectContext.location || projectInfo?.loc) &&
          `Location: ${projectContext.location || projectInfo?.loc}`,
        (projectInfo?.riba || projectContext.riba) &&
          `RIBA Stage: ${projectInfo?.riba || projectContext.riba}`,
      ]
        .filter(Boolean)
        .join(" | ")
    : null;

  const prompt = `You are a senior risk management professional. For each risk below, generate 3 mitigation controls that directly address the specific risk title, description, category, and current score provided. Do not give generic advice — every control must respond to the exact details of that risk.
${projectLine ? `\nPROJECT CONTEXT: ${projectLine}\nTailor controls to this specific project type, stage, and location.\n` : ""}
${risksArray
  .map((r) => {
    const gross = r.grossRating ?? (r.grossL || 0) * (r.grossI || 0);
    const residual = r.residualRating ?? "N/A";
    return `RISK ID: ${r.id}
Title: ${r.title}
Description: ${r.desc || "Not provided"}
Category: ${r.category || "N/A"} | Workstream: ${r.workstream || "N/A"}
Owner: ${r.owner || "Not assigned"}
Gross Score: ${gross} | Residual Score: ${residual}
Existing Controls: ${r.controls && r.controls !== "None" ? r.controls : "None in place"}`;
  })
  .join("\n\n")}

Each control suggestion must follow this format:
WHAT: [specific action for this risk] WHO: [responsible role] WHEN: [timing or trigger] HOW: [exact steps]

FORMATTING: NO MARKDOWN. No **bold**, no headers, no bullet points. Plain text only.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          riskId: {
            type: "string",
            description:
              "The exact RISK ID string from the input (copy it verbatim, e.g. 'risk-0001')",
          },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description:
              "3 mitigation control suggestions, each with WHAT WHO WHEN HOW",
          },
        },
        required: ["riskId", "suggestions"],
      },
    },
  };

  try {
    const res = await api.analyzeControls(prompt, config);
    if (!res.success) throw new Error(res.error || "Analysis failed");
    return Array.isArray(res.result) ? res.result : [];
  } catch (err: any) {
    console.error("Control Analysis Error:", err);
    handleAIError(err, "Control analysis");
    throw err;
  }
}

export async function analyzeStrategicInsights(
  context: { compliance: any; risks: any; issues: any; projects?: any[] },
  user?: any,
) {
  const prompt = `You are a Chief Technology Officer and Compliance Director for a major social housing organization. 
Analyse the following cross-functional data (Compliance, Risks, and Issues) and provide strategic, high-level corporate insights. 

USER ROLE:
${user?.role || "Executive"} (${user?.email || "Anonymous"})

DATA OVERVIEW:
- Compliance Posture: ${JSON.stringify(context.compliance)}
- Risk Exposure: ${JSON.stringify(context.risks)}
- Live Issues: ${JSON.stringify(context.issues)}
${Array.isArray(context.projects) ? `- Portfolio Scale: ${context.projects.length} projects` : ""}

Provide a "Strategic Outlook" that synthesizes this information. Focus on:
1. Identify EXACTLY 3 critical blindspots or intersectional threats. Keep each to ONE brief sentence.
2. A "Portfolio Health Score" recommendation based on regulatory compliance and risk velocity.
3. EXACTLY 3 Urgent Strategic Priorities and EXACTLY 3 Suggestions for the Executive Board. ONE brief sentence each. 
4. Maintain a highly concise, punchy style. Make it readable at a glance.
5. Qualitative assessment of 'Reporting Sentiment' (proactive vs reactive).

INSTRUCTIONS (STRICT COMPLIANCE REQUIRED):
1. ABSOLUTELY NO MARKDOWN in any string field. No **bold**, no # headers, no _italics_, no \`code\`.
2. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL.
3. Keep the tone extremely professional, objective, and authoritative. AVOUD fluff and unnecessary adjectives.
`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        outlook: {
          type: "string",
          description: "3-4 sentence strategic summary",
        },
        healthScore: { type: "number", description: "Score from 0-100" },
        healthRationale: { type: "string" },
        criticalBlindspots: {
          type: "array",
          items: { type: "string" },
          description: "Provide exactly 3 critical blindspots. Maximum 1 sentence each.",
        },
        strategicPriorities: {
          type: "array",
          items: { type: "string" },
          description: "Provide exactly 3 urgent strategic priorities. Maximum 1 sentence each.",
        },
        detailedSuggestions: {
          type: "array",
          items: { type: "string" },
          description:
            "Provide exactly 3 suggestions. Maximum 1 sentence each.",
        },
      },
      required: [
        "outlook",
        "healthScore",
        "healthRationale",
        "criticalBlindspots",
        "strategicPriorities",
        "detailedSuggestions",
      ],
    },
  };

  try {
    const res = await api.analyzeCompliance(prompt, config);
    if (!res.success) throw new Error(res.error || "Strategic analysis failed");
    return res.result || {};
  } catch (err: any) {
    console.error("Strategic Analysis Error:", err);
    handleAIError(err, "Strategic insights analysis");
    throw err;
  }
}

export async function analyzeComplianceProgress(domainStats: any[]) {
  const prompt = `You are a Chief Risk Officer. Analyse the following compliance metrics across regulatory domains and provide a highly specific, detailed paragraph for each domain indicating current posture.
  
  For every domain summary, you MUST address:
  - WHAT: The specific status and critical gaps.
  - WHO: The responsible parties or regulatory bodies.
  - WHEN: Key assessment dates or next review points.
  - HOW: The exact method of status tracking and improvement.
  - WHERE: The specific asset portfolio or process area.
  - WHY: The regulatory driver and the impact of the current status.
  
  Keep the posture assessment authoritative, objective, and professional. Do not use introductory phrases.
  
  DATA: ${JSON.stringify(domainStats)}`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          domain: { type: "string" },
          summary: {
            type: "string",
            description:
              "A single, actionable sentence summarizing the compliance posture.",
          },
        },
      },
    },
  };

  try {
    const res = await api.analyzeCompliance(prompt, config);
    if (!res.success) throw new Error(res.error || "Analysis failed");
    return Array.isArray(res.result) ? res.result : [];
  } catch (err: any) {
    console.error("Compliance Progress Analysis Error:", err);
    handleAIError(err, "Compliance progress analysis");
    throw err;
  }
}

export async function analyzeContextSentence(
  sentence: string,
  type: "risk" | "compliance" = "risk",
) {
  // ── Compliance path — returns structured objects ──────────────────
  if (type === "compliance") {
    const DOMAIN_IDS =
      "hs,bs,fs,bc,pl,pr,en,qu,ut,dr,sh,hq,ha,ac,ee,ah,sv,pw,fc,lc,dm,lr";
    const prompt = `You are a UK statutory compliance specialist in construction and property management.

The user has described the following specific project or situation:
"${sentence}"

Identify 10 statutory compliance requirements that directly and specifically apply to this description. Every item must respond to exactly what was described — do not list requirements that could apply to any generic project.

For each requirement:
- req: A clear, specific statement of what must be done to comply — one or two sentences.
- reg: The exact regulation, statute, or standard (e.g. CDM 2015 Reg 4, BSA 2022 s.5, Building Regs Part B).
- domain: One domain id from: ${DOMAIN_IDS}
- who: 2 sentences — name the specific dutyholder role and their legal obligation under this requirement.
- when: 2 sentences — state the specific project stage, gateway, or event that triggers this requirement and the consequence of missing it.
- how: A concise explanation of the evidence, action, or process required to comply.
- risk: Severity of non-compliance (Low / Medium / High / Critical).
- stage: Current posture (Information Gap = not yet investigated, Risk Identified = gap confirmed, In Progress = being addressed).
- status: Always "applicable".

FORMATTING: NO MARKDOWN. No **bold**, no headers, no bullet points. All string fields must be plain prose text only.`;

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            req: {
              type: "string",
              description:
                "The specific compliance requirement — what must be done",
            },
            reg: {
              type: "string",
              description:
                "The exact regulation or standard reference (e.g. CDM 2015 Reg 4, BSA 2022 s.5, Building Regs Part B)",
            },
            domain: {
              type: "string",
              description: `One domain id from: ${DOMAIN_IDS}`,
            },
            who: {
              type: "string",
              description: "The responsible dutyholder or role",
            },
            when: {
              type: "string",
              description: "The trigger point, gateway, or deadline",
            },
            how: {
              type: "string",
              description:
                "The evidence, action, or process required to comply",
            },
            risk: {
              type: "string",
              enum: ["Low", "Medium", "High", "Critical"],
              description: "Severity of non-compliance",
            },
            stage: {
              type: "string",
              enum: ["Information Gap", "Risk Identified", "In Progress"],
              description: "Current posture stage",
            },
            status: {
              type: "string",
              enum: ["applicable"],
              description:
                "Always applicable for newly identified requirements",
            },
          },
          required: [
            "req",
            "reg",
            "domain",
            "who",
            "when",
            "how",
            "risk",
            "stage",
            "status",
          ],
        },
      },
    };

    try {
      const res = await api.analyzeCompliance(prompt, config);
      if (!res.success) throw new Error(res.error || "Analysis failed");
      return Array.isArray(res.result) ? res.result : [];
    } catch (err: any) {
      console.error("Compliance Outlook Analysis Error:", err);
      handleAIError(err, "Compliance analysis");
      throw err;
    }
  }

  // ── Risk path — returns plain strings (existing behaviour) ────────
  const prompt = `You are a specialist in UK construction and property risk management.

The user has described the following specific concern:
"${sentence}"

Generate 5 risk mitigation strategies that directly and specifically address this concern. Every strategy must respond to exactly what was described above — do not give generic advice that could apply to any situation.

Each strategy must follow this structure:
WHAT: [specific action addressing the concern above] WHO: [named responsible role] WHEN: [exact timing or trigger] HOW: [concrete implementation steps]

5 strategies only. FORMATTING: NO MARKDOWN. No **bold**, no headers, no bullet points. Plain text only.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "array",
      items: { type: "string" },
    },
  };

  try {
    const res = await api.analyzeRisks(prompt, config);
    if (!res.success) throw new Error(res.error || "Analysis failed");
    return Array.isArray(res.result) ? res.result : [];
  } catch (err: any) {
    console.error("Ad-hoc Risk Analysis Error:", err);
    handleAIError(err, "Analysis");
    throw err;
  }
}

export async function analyzeComplianceLifecycle(
  projectInfo: any,
  complianceItems: any[],
) {
  const safeItems = Array.isArray(complianceItems) ? complianceItems : [];
  const compCtx = safeItems
    .map(
      (i) =>
        `${i.id}|${i.stage_link || "N/A"}|${(i.req || "").slice(0, 50)}|${i.stage || "N/A"}`,
    )
    .join("\n");
  const prompt = `You are a Senior RIBA Architect and Compliance Lead. Analyse the following project's compliance evolution across RIBA stages 0-7.
  
  PROJECT: ${JSON.stringify(projectInfo)}
  COMPLIANCE ITEMS: ${compCtx}
  
  TASK:
  1. Provide exactly 10-12 key 'Stage-Gate' requirements mapping specific compliance needs to RIBA milestones.
  2. For each, specify the What, Who, When, How, Where, and Why.
  3. Identify potential bottlenecks in the transition between stages (e.g. Gateway 2 for Building Safety Act).
  
  Focus on the 'Lifecycle' aspect—how requirements shift from strategic definition to handover and use.
  FORMATTING (STRICT): ABSOLUTELY NO MARKDOWN in any field. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        lifecycleRoadmap: {
          type: "array",
          items: {
            type: "object",
            properties: {
              stage: { type: "string" },
              requirement: { type: "string" },
              actionableInsight: { type: "string" },
              responsible: { type: "string" },
            },
            required: [
              "stage",
              "requirement",
              "actionableInsight",
              "responsible",
            ],
          },
        },
        bottlenecks: { type: "array", items: { type: "string" } },
        strategicSummary: { type: "string" },
      },
      required: ["lifecycleRoadmap", "bottlenecks", "strategicSummary"],
    },
  };

  try {
    const res = await api.analyzeCompliance(prompt, config);
    if (!res.success) throw new Error(res.error || "Lifecycle analysis failed");
    return res.result ?? null;
  } catch (err: any) {
    console.error("Lifecycle Analysis Error:", err);
    handleAIError(err, "Lifecycle analysis");
    throw err;
  }
}

export async function analyzeSensitivity(
  projectInfo: any,
  risks: any[],
  compliancePct: number,
  totalALE: number,
) {
  const safeRisks = Array.isArray(risks) ? risks : [];
  const riskCtx = safeRisks
    .map((r) => `${r.title} (ALE: £${(r.residualALE || 0).toLocaleString()})`)
    .join("\n");
  const prompt = `You are a Senior Risk Actuary. Perform a deep-dive strategic sensitivity analysis for "${projectInfo?.name || "this project"}".
  
  CONTEXT:
  - Risks: ${riskCtx || "No specific risks logged"}
  - Compliance Status: ${compliancePct}% complete
  - Total Potential Exposure (ALE): £${totalALE.toLocaleString()}
  
  TASK:
  1. Identify 10 detailed 'Sensitivity Guardrails' based on the risk profile.
  2. For each, you MUST address: WHAT (volatility), WHO (impacted), WHEN (trigger), HOW (mitigation), WHERE (scope), and WHY (residual impact).
  3. Analyze latent volatility in the project's financial exposure.
  4. Suggest at least 10 specific, highly detailed contingency strategies.
  5. Each contingency strategy must specify the WHAT, WHO, WHEN, HOW, WHERE, and WHY.
  
  Provide a professional, data-driven report.
  FORMATTING (STRICT): ABSOLUTELY NO MARKDOWN in any field. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        guardrails: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              details: { type: "string" },
              riskVector: { type: "string" },
            },
            required: ["title", "details", "riskVector"],
          },
        },
        volatilityAnalysis: { type: "string" },
        contingencyStrategies: { type: "array", items: { type: "string" } },
        summary: { type: "string" },
      },
      required: [
        "guardrails",
        "volatilityAnalysis",
        "contingencyStrategies",
        "summary",
      ],
    },
  };

  try {
    // Using analyzeRisks as it's more appropriate for sensitivity/ALE focus
    const res = await api.analyzeRisks(prompt, config);
    if (!res.success)
      throw new Error(res.error || "Sensitivity analysis failed");
    return res.result ?? null;
  } catch (err: any) {
    console.error("Sensitivity Analysis Error:", err);
    handleAIError(err, "Sensitivity analysis");
    throw err;
  }
}

export async function analyzeComplianceSentiment(
  projectInfo: any,
  complianceItems: any[],
) {
  const safeItems = Array.isArray(complianceItems) ? complianceItems : [];
  const compCtx = safeItems
    .map((i) => `${(i.req || "").slice(0, 50)}: ${i.stage || "N/A"}`)
    .join("\n");
  const prompt = `You are a Regulatory Sentiment Auditor. Assess the qualitative 'Confidence' and 'Sentiment' of the compliance status for this project.
  
  PROJECT: ${JSON.stringify(projectInfo)}
  CURRENT STATUS:
  ${compCtx}
  
  TASK:
  1. Determine an overall 'Confidence Score' (0-100).
  2. Provide a 'Sentiment Tone' (e.g. Proactive, Reactive, Critical, Complacent).
  3. Identify at least 10 detailed reasons/rationale for this sentiment.
  4. Suggest at least 10 'Cultural Shifts' needed for better compliance posture.
  5. For every rationale and cultural shift, you MUST specify the WHAT, WHO, WHEN, HOW, WHERE, and WHY.
  
  Your tone should be authoritative but objective. Focus on how complete or incomplete requirements impact overall project delivery confidence.
  FORMATTING (STRICT): ABSOLUTELY NO MARKDOWN in any field. ANY IDENTIFIER OR ID MUST BE ON THE SAME LINE AS ITS LABEL.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        confidenceScore: { type: "number" },
        sentimentTone: { type: "string" },
        rationale: { type: "array", items: { type: "string" } },
        culturalShifts: { type: "array", items: { type: "string" } },
        auditorNote: { type: "string" },
      },
      required: [
        "confidenceScore",
        "sentimentTone",
        "rationale",
        "culturalShifts",
        "auditorNote",
      ],
    },
  };

  try {
    const res = await api.analyzeCompliance(prompt, config);
    if (!res.success) throw new Error(res.error || "Sentiment analysis failed");
    return res.result ?? null;
  } catch (err: any) {
    console.error("Sentiment Analysis Error:", err);
    handleAIError(err, "Compliance sentiment analysis");
    throw err;
  }
}

export async function chatWithAI(
  query: string,
  projectInfo: any,
  context?: string,
  lastAnalysis?: any,
  user?: any,
  contextData?: any,
) {
  // Extract real data for more specific context
  const analysisContext = lastAnalysis
    ? {
        summary: lastAnalysis.summary,
        criticalActions: (lastAnalysis.criticalActions || [])
          .slice(0, 5)
          .map((a: any) => a.title || a.action || a),
        keyRisks: (lastAnalysis.keyRisks || [])
          .slice(0, 5)
          .map((r: any) => r.title || r.risk || r),
        overallRag: lastAnalysis.overallRag || "Unknown",
      }
    : null;

  // Build live data sections from contextData (compliance tracker, risk register, issues)
  const entitySection = contextData?.entity
    ? `ACTIVE ${contextData.entity.isProject ? "PROJECT" : "PROGRAMME"}:\nName: ${contextData.entity.name || "N/A"} | Type: ${contextData.entity.type || "N/A"} | Location: ${contextData.entity.location || "N/A"}\nDescription: ${contextData.entity.description || "N/A"}\nCompliance Setup Done: ${contextData.entity.complianceSetupDone ? "Yes" : "No"} | Risk Setup Done: ${contextData.entity.riskSetupDone ? "Yes" : "No"}`
    : "";

  const complianceSection = contextData?.compliance
    ? `COMPLIANCE TRACKER (live):\nTotal: ${contextData.compliance.total} | Complete: ${contextData.compliance.complete} | In Progress: ${contextData.compliance.inProgress} | Not Started: ${contextData.compliance.notStarted} | High Risk Open: ${contextData.compliance.highRiskOpen}\nTop High-Risk Incomplete: ${JSON.stringify(contextData.compliance.topHighRisk)}`
    : "";

  const riskSection = contextData?.risks
    ? `RISK REGISTER (live):\nTotal: ${contextData.risks.total} | Open: ${contextData.risks.open} | High Severity (rating≥16): ${contextData.risks.highSeverity}\nTop Open Risks: ${JSON.stringify(contextData.risks.topOpen)}`
    : "";

  const issueSection = contextData?.issues
    ? `ISSUES (live):\nTotal: ${contextData.issues.total} | Open: ${contextData.issues.open} | Escalated: ${contextData.issues.escalated}\nTop Open Issues: ${JSON.stringify(contextData.issues.topOpen)}`
    : "";

  const prompt = `
    You are CedarGuard AI, a professional compliance and risk expert for the Cedar Property Compliance & Risk Manager Suite.

    USER ROLE:
    ${user?.role || "Project Stakeholder"} (${user?.email || "Anonymous"})

    ${entitySection}

    PROJECT PROFILE (questionnaire answers):
    ${JSON.stringify(projectInfo, null, 2)}

    PREVIOUS AI ANALYSIS RESULTS:
    ${analysisContext ? JSON.stringify(analysisContext, null, 2) : "No analysis performed yet."}

    ${complianceSection}

    ${riskSection}

    ${issueSection}

    CURRENT PAGE/USER CONTEXT:
    ${context || "General Overview"}
    
    USER QUERY:
    "${query}"
    
    Your goal is to provide accurate, actionable, and highly specific guidance based on the project profile and UK building regulations (Building Safety Act 2022, Fire Safety Act, RSH standards).
    
    INSTRUCTIONS (STRICT COMPLIANCE REQUIRED):
    1. Do not give generic answers. Use the provided PROJECT PROFILE and ANALYSIS RESULTS.
    2. If the user asks about HRB, check if the project is an HRB in the profile.
    3. If the user asks for "what to do next", refer to the RIBA stages and current progress.
    4. Provide specific UK regulatory references where applicable.
    5. Maintain a professional, expert tone tailored to their role.
    
    6. OUTPUT FORMATTING (CRITICAL):
       - ABSOLUTELY NO MARKDOWN. No **bold**, no # headers, no _italics_, no \`code\`.
       - DO NOT use bullet points like * or -. Use numbers (1., 2.) or short capitalized labels.
       - ANY IDENTIFIER OR ID (e.g. REPORT ID, RISK ID, CASE ID) MUST BE ON THE SAME LINE AS ITS LABEL. Example: "REFERENCE ID: CEDAR-99" (NOT on a new line).
       - FOR ALL RECOMMENDATIONS AND KEY INSIGHTS, provide extreme detail addressing:
         WHAT (Specific action), WHO (Responsible), WHEN (Deadline/Trigger), HOW (Method), WHERE (Scope), and WHY (Driver/Impact).
       - USE THE FOLLOWING STRUCTURE FOR LONG RESPONSES:
         TITLE IN ALL CAPS
         
         EXECUTIVE SUMMARY
         (Brief 1-2 sentence overview)
         
         SECTION 1: [TOPIC NAME]
         1. [Detail]
         2. [Detail]
         
         SECTION 2: [TOPIC NAME]
         1. [Detail]
         2. [Detail]
         
         RECOMMENDED ACTIONS
         1. [Action (including 5W+1H)]
         2. [Action (including 5W+1H)]

    7. SPACING: Use double newlines between paragraphs and sections to ensure a clean, vertical layout.
    8. NO PLACEHOLDERS: Always provide final, actionable text.

    Your response must be a valid JSON object with a single field 'message' containing your cleanly organized plain text response.
  `;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
    },
  };

  try {
    const res = await api.analyzeCompliance(prompt, config);
    if (!res.success) throw new Error(res.error || "AI Chat failed");
    return res.result?.message ?? "";
  } catch (err: any) {
    console.error("AI Chat Error:", err);
    handleAIError(err, "AI chat");
    throw err;
  }
}
