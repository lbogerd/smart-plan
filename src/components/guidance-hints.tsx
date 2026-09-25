import type { Plan } from "../lib/schema";
import { guidanceSuggestions } from "../lib/guidance";
export function GuidanceHints({ plan }: { plan: Plan }) {
  const suggestions = guidanceSuggestions(plan);
  if (!suggestions.length) return null;
  return (
    <details className="guidance-hints">
      <summary>Optional guidance suggestions ({suggestions.length})</summary>
      <ul>
        {suggestions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </details>
  );
}
