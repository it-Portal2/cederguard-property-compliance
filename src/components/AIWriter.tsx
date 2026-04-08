import React, { useState } from 'react';
import { ScanSearch, Loader2, Check, X, ShieldCheck } from 'lucide-react';

interface AIWriterProps {
  onSuggest: (content: string) => void;
  context: string;
  placeholder?: string;
  label?: string;
  className?: string;
}

export const AIWriter: React.FC<AIWriterProps> = ({
  onSuggest,
  context,
  label = "AI Assist",
  className = ""
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const generateSuggestion = async () => {
    setIsGenerating(true);
    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockSuggestions: Record<string, string> = {
      "risk": "A significant project delay is anticipated due to prolonged lead times for essential structural components, specifically high-grade steel and specialized glass panels. Mitigation strategies include early procurement orders and identifying alternative local suppliers to ensure Gateway 2 compliance timelines are met.",
      "compliance": "Technical building standards for Gateway 2 require comprehensive documentation of structural integrity and fire safety measures. The current status indicates a need for final certification from the lead structural engineer and a verified fire strategy report from the accredited consultant.",
      "regulation": "The Building Safety Act 2022 introduces a new regulatory framework for higher-risk buildings. Key requirements include the creation of a 'golden thread' of information, mandatory reporting of safety concerns, and the implementation of a safety case approach to demonstrate ongoing risk management throughout the building's lifecycle."
    };

    const key = Object.keys(mockSuggestions).find(k => context.toLowerCase().includes(k)) || "compliance";
    setSuggestion(mockSuggestions[key]);
    setIsGenerating(false);
  };

  const handleApply = () => {
    if (suggestion) {
      onSuggest(suggestion);
      setSuggestion(null);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {!suggestion ? (
        <button
          onClick={generateSuggestion}
          disabled={isGenerating}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <ScanSearch className="w-3.5 h-3.5" />
              {label}
            </>
          )}
        </button>
      ) : (
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-white border border-indigo-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-indigo-700">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-sm font-semibold">AI Suggestion</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setSuggestion(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                title="Discard"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed italic mb-4 whitespace-pre-wrap">
            "{suggestion}"
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSuggestion(null)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Apply Suggestion
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
