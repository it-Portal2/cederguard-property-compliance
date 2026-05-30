import * as XLSX from 'xlsx'
import { differenceInDays } from 'date-fns'

function scoreLabel(p: number | string, s: number | string): string {
  const map: Record<string, number> = { Low: 1, Medium: 3, High: 5, Critical: 10 }
  const pv = typeof p === 'number' ? p : (map[String(p)] || 1)
  const sv = typeof s === 'number' ? s : (map[String(s)] || 1)
  const v = pv * sv
  if (v >= 20) return 'Critical'
  if (v >= 12) return 'High'
  if (v >= 8) return 'Medium'
  return 'Low'
}

function fDate(d?: string): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString() } catch { return d }
}

function ageCalc(d?: string, status?: string): string {
  if (!d || status === '4. Resolved') return '—'
  try { return differenceInDays(new Date(), new Date(d)) + 'd' } catch { return '—' }
}

export type ExportPage = 'issues' | 'risk' | 'tracker' | 'compliance' | 'full'

export interface ExportContextOpts {
  page: ExportPage
  complianceItems: any[]
  risks: any[]
  issues: any[]
  projects: any[]
  contextId: string | undefined
  isProject: boolean
  contextName: string
}

export async function exportContextData(opts: ExportContextOpts): Promise<void> {
  const { page, complianceItems, risks, issues, projects, contextId, isProject, contextName } = opts
  const wb = XLSX.utils.book_new()

  const ctxCompliance = (Array.isArray(complianceItems) ? complianceItems : []).filter((c: any) =>
    isProject ? c.projectId === contextId : c.programmeId === contextId
  )
  const ctxRisks = (Array.isArray(risks) ? risks : []).filter((r: any) =>
    isProject ? r.projectId === contextId : r.programmeId === contextId
  )
  const ctxIssues = (Array.isArray(issues) ? issues : []).filter((i: any) =>
    isProject ? i.projectId === contextId : i.programmeId === contextId
  )
  const safeProjects = Array.isArray(projects) ? projects : []

  if (page === 'issues') {
    const rows = ctxIssues.map((iss: any) => ({
      'Issue Ref': iss.id,
      'Risk Ref': iss.linkedRisk || '',
      'Date Added': fDate(iss.dateAdded),
      'Issue Description': iss.desc || '',
      'Impact': iss.impact || '',
      'Issue Owner': iss.owner || '',
      'Priority': iss.priority ?? '',
      'Severity': iss.severity ?? '',
      'Score': scoreLabel(iss.priority, iss.severity),
      'Issue Response': iss.response || '',
      'Response Description': iss.responsDesc || '',
      'Control Owner': iss.controlOwner || '',
      'Progress Updates': iss.progress || '',
      'Date Updated': fDate(iss.dateUpdated),
      'Control Deadline': fDate(iss.deadline),
      'Status': iss.status || '',
      'Age': ageCalc(iss.dateAdded, iss.status),
      'Lessons Learnt': iss.lessonsLearnt || '',
      'Source Project': safeProjects.find((p: any) => p.id === iss.projectId)?.name || (iss.isProgrammeLevel ? 'Programme Level' : ''),
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No issues data for this context.' }]), 'Issues Register')

  } else if (page === 'risk') {
    const rows = ctxRisks.map((r: any) => ({
      'Ref': r.id,
      'Workstream': r.workstream || '—',
      'Linked KRI': r.kri || '—',
      'Date Added': r.dateAdded ? new Date(r.dateAdded).toLocaleDateString() : '—',
      'Risk Title': r.title || '',
      'Risk Desc': r.desc || '',
      'Gross L': r.grossL ?? '',
      'Gross I': r.grossI ?? '',
      'Gross Rating': r.grossRating ?? '',
      'Response': r.response || '—',
      'Controls': r.controls || '—',
      'Residual L': r.residualL ?? '',
      'Residual I': r.residualI ?? '',
      'Residual Rating': r.residualRating ?? '',
      'Appetite': r.appetite || '—',
      'Further Action': r.furtherAction || '—',
      'Status': r.status || '',
      'Gross Impact (£)': r.grossImpact || 0,
      'Gross ALE (£)': Math.round(r.grossALE || 0),
      'Residual Impact (£)': r.residualImpact || 0,
      'Residual ALE (£)': Math.round(r.residualALE || 0),
      'Reduction (£)': Math.round((r.grossALE || 0) - (r.residualALE || 0)),
      'Indicator': r.escalated ? 'ESC' : r.convertedToIssue ? 'ISSUE' : '—',
      'Owner': r.owner || '',
      'Escalated': r.escalated ? 'Yes' : 'No',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No risk data for this context.' }]), 'Risk Register')

  } else if (page === 'tracker' || page === 'compliance') {
    const rows = ctxCompliance.map((c: any) => ({
      'ID': c.id,
      'Regulation': c.reg || '',
      'Domain': c.domain || '',
      'Requirement': c.req || '',
      'Stage': c.stage || 'Not Started',
      'Status': c.status || 'applicable',
      'Risk Level': c.risk || 'Medium',
      'Authority': c.auth || '',
      'Trigger': c.trigger || '',
    }))
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No compliance data for this context.' }]),
      page === 'tracker' ? 'Compliance Tracker' : 'Compliance Items'
    )

  } else {
    if (ctxCompliance.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ctxCompliance.map((c: any) => ({
        ID: c.id, Regulation: c.reg || '', Domain: c.domain || '', Requirement: c.req || '',
        Stage: c.stage || 'Not Started', Status: c.status || 'applicable',
        'Risk Level': c.risk || 'Medium', Authority: c.auth || '', Trigger: c.trigger || '',
      }))), 'Compliance Items')
    }
    if (ctxRisks.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ctxRisks.map((r: any) => ({
        ID: r.id, Title: r.title || '', Category: r.category || '', Workstream: r.workstream || '',
        Status: r.status || '', 'Gross Likelihood': r.grossL ?? '', 'Gross Impact': r.grossI ?? '',
        'Gross Rating': r.grossRating ?? (r.grossL && r.grossI ? r.grossL * r.grossI : ''),
        Owner: r.owner || '', 'Due Date': r.dueDate || '', Escalated: r.escalated ? 'Yes' : 'No',
      }))), 'Risk Register')
    }
    if (ctxIssues.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ctxIssues.map((i: any) => ({
        ID: i.id, Title: i.title || i.desc?.substring(0, 60) || '',
        Description: i.desc || '', Status: i.status || '', Impact: i.impact || '',
        Owner: i.owner || '', Priority: i.priority ?? '', Deadline: i.deadline || '',
      }))), 'Issues')
    }
    if (!ctxCompliance.length && !ctxRisks.length && !ctxIssues.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Note: 'No data available for this context yet.' }]), 'Summary')
    }
  }

  const fileName = `${(contextName || 'CedarGuard').replace(/\s+/g, '_')}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
}
