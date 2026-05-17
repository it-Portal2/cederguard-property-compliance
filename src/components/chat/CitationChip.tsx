import React from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  MessageSquare,
  CheckSquare,
  FolderKanban,
  Layers,
  Activity,
  Calendar,
  Users,
  FileText,
  ClipboardList,
  HelpCircle,
  ListTodo,
} from "lucide-react";
import { clsx } from "clsx";
import type { Citation } from "../../lib/chatTransport";

const KIND_CONFIG: Record<
  string,
  { icon: React.ComponentType<any>; colour: string; label: string }
> = {
  risk: { icon: AlertTriangle, colour: "text-orange-600 bg-orange-50 border-orange-200", label: "Risk" },
  issue: { icon: MessageSquare, colour: "text-red-600 bg-red-50 border-red-200", label: "Issue" },
  compliance: { icon: CheckSquare, colour: "text-emerald-600 bg-emerald-50 border-emerald-200", label: "Compliance" },
  project: { icon: FolderKanban, colour: "text-indigo-600 bg-indigo-50 border-indigo-200", label: "Project" },
  programme: { icon: Layers, colour: "text-purple-600 bg-purple-50 border-purple-200", label: "Programme" },
  kri: { icon: Activity, colour: "text-amber-600 bg-amber-50 border-amber-200", label: "KRI" },
  forwardPlan: { icon: Calendar, colour: "text-blue-600 bg-blue-50 border-blue-200", label: "Forward Plan" },
  meeting: { icon: Users, colour: "text-teal-600 bg-teal-50 border-teal-200", label: "Meeting" },
  report: { icon: FileText, colour: "text-slate-600 bg-slate-50 border-slate-200", label: "Report" },
  enquiry: { icon: ClipboardList, colour: "text-cyan-600 bg-cyan-50 border-cyan-200", label: "Enquiry" },
  rfi: { icon: HelpCircle, colour: "text-pink-600 bg-pink-50 border-pink-200", label: "RFI" },
  task: { icon: ListTodo, colour: "text-violet-600 bg-violet-50 border-violet-200", label: "Task" },
};

interface CitationChipProps {
  citation: Citation;
}

export function CitationChip({ citation }: CitationChipProps) {
  const config = KIND_CONFIG[citation.kind] ?? {
    icon: FileText,
    colour: "text-slate-600 bg-slate-50 border-slate-200",
    label: citation.kind,
  };
  const Icon = config.icon;

  return (
    <Link
      to={citation.route}
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all hover:scale-105 hover:shadow-sm",
        config.colour,
      )}
      title={`View ${config.label}: ${citation.label}`}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="truncate max-w-[140px]">{citation.label}</span>
    </Link>
  );
}
