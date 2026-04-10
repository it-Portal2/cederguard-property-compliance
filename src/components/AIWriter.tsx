import React, { useState } from 'react';
import { ScanSearch, Loader2, Check, X, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { handleAIError } from '../services/aiService';
import { stripMarkdown } from '../lib/utils';

/** Trim AI response to the first N complete sentences, max `maxChars` chars. */
function truncateToSentences(text: string, maxChars = 220): string {
  if (text.length <= maxChars) return text;
  // Find the last sentence boundary within maxChars
  const slice = text.slice(0, maxChars);
  const lastPeriod = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
  return lastPeriod > 40 ? slice.slice(0, lastPeriod + 1).trim() : slice.trim() + '…';
}

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
    try {
      const res = await api.testGemini(context);
      if (!res?.success || !res?.result) throw new Error('Empty AI response');
      const clean = truncateToSentences(stripMarkdown(res.result));
      setSuggestion(clean);
    } catch (err: any) {
      handleAIError(err, 'AI draft');
    } finally {
      setIsGenerating(false);
    }
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
