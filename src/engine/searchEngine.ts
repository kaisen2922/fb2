import type { AutomationProject } from '../types';

/**
 * Fuzzy search matches a project against a query.
 * Checks if the query words appear in the project's key text fields.
 */
export const fuzzyMatchProject = (
  project: AutomationProject,
  query: string
): boolean => {
  if (!query) return true;
  
  const cleanQuery = query.toLowerCase().trim();
  const queryWords = cleanQuery.split(/\s+/);
  
  // Fields to search in
  const searchableText = [
    project.project_name,
    project.company_id,
    project.country,
    project.implementation_partner,
    project.industry,
    project.department,
    project.automation_type,
    project.project_id
  ].map(field => (field || '').toLowerCase());

  // All query words must match somewhere in the searchable text fields
  return queryWords.every(word => 
    searchableText.some(text => text.includes(word))
  );
};

/**
 * Highlight helper that takes a text string and a search query,
 * and splits the text into chunks of highlights and normal text.
 */
export const highlightMatch = (text: string, query: string): (string | { highlight: boolean; text: string })[] => {
  if (!text) return [text];
  if (!query) return [text];

  const cleanQuery = query.trim();
  if (!cleanQuery) return [text];

  // Escape special regex characters
  const escapedQuery = cleanQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  
  // Support matching individual words
  const words = escapedQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];

  // Combine words into an OR regex
  const regexPattern = `(${words.join('|')})`;
  const regex = new RegExp(regexPattern, 'gi');
  
  const parts = text.split(regex);
  const wordsSet = new Set(words.map(w => w.toLowerCase()));

  return parts.map(part => {
    const isHighlight = wordsSet.has(part.toLowerCase()) || 
                       words.some(w => part.toLowerCase().includes(w.toLowerCase()));
    return isHighlight ? { highlight: true, text: part } : part;
  });
};
