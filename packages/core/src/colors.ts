export interface HighlightColor {
  level: "low" | "medium" | "high";
  className: string;
  backgroundColor: string;
  borderColor: string;
}

export function getHighlightColor(similarity: number): HighlightColor {
  if (similarity >= 0.85) {
    return {
      level: "high",
      className: "dupdoc-highlight--high",
      backgroundColor: "rgba(239, 68, 68, 0.22)",
      borderColor: "rgba(239, 68, 68, 0.75)"
    };
  }

  if (similarity >= 0.65) {
    return {
      level: "medium",
      className: "dupdoc-highlight--medium",
      backgroundColor: "rgba(245, 158, 11, 0.24)",
      borderColor: "rgba(245, 158, 11, 0.8)"
    };
  }

  return {
    level: "low",
    className: "dupdoc-highlight--low",
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "rgba(59, 130, 246, 0.7)"
  };
}

export function createHighlightClass(similarity: number, active = false, ignored = false): string {
  const color = getHighlightColor(similarity);
  return [
    "dupdoc-highlight",
    color.className,
    active ? "dupdoc-highlight--active" : "",
    ignored ? "dupdoc-highlight--ignored" : ""
  ]
    .filter(Boolean)
    .join(" ");
}
