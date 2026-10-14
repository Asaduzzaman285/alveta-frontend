/**
 * Turns a raw tool-call event into something a user can read while it's running.
 *
 * The streaming protocol has always emitted `tool-input-available` / `tool-output-available`
 * for every tool call (search, image generation, documents) — the frontend simply never
 * listened for them, which is the whole reason a slow image generation or search looked
 * like nothing was happening. This is what turns those events into "Searching the web
 * for '...'" instead of silence.
 */

export interface ActiveToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  /** Only meaningful for WebSearchTool today — see resultSummary() below. */
  output?: string
}

/** toolName as it appears in the SSE payload → a short present-tense label. */
const RUNNING_LABELS: Record<string, (input: Record<string, unknown>) => string> = {
  WebSearchTool: (input) => `Searching the web for "${truncate(String(input.query ?? ''))}"`,
  GenerateImageTool: () => 'Generating your image…',
  GenerateSpreadsheetTool: () => 'Generating your spreadsheet…',
  GeneratePresentationTool: () => 'Generating your presentation…',
  GeneratePdfTool: () => 'Generating your PDF…',
  GenerateDocxTool: () => 'Generating your document…',
  GenerateDesignTool: () => 'Generating your design…',
}

const DONE_LABELS: Record<string, (call: ActiveToolCall) => string> = {
  WebSearchTool: (call) => resultSummary(call.output),
  GenerateImageTool: () => 'Image generated',
  GenerateSpreadsheetTool: () => 'Spreadsheet generated',
  GeneratePresentationTool: () => 'Presentation generated',
  GeneratePdfTool: () => 'PDF generated',
  GenerateDocxTool: () => 'Document generated',
  GenerateDesignTool: () => 'Design generated',
}

export function toolActivityLabel(call: ActiveToolCall): string {
  if (call.status === 'error') {
    const name = FRIENDLY_NAMES[call.name] ?? 'That tool'
    return `${name} failed`
  }

  if (call.status === 'running') {
    return RUNNING_LABELS[call.name]?.(call.input) ?? 'Working…'
  }

  return DONE_LABELS[call.name]?.(call) ?? 'Done'
}

const FRIENDLY_NAMES: Record<string, string> = {
  WebSearchTool: 'Web search',
  GenerateImageTool: 'Image generation',
  GenerateSpreadsheetTool: 'Spreadsheet generation',
  GeneratePresentationTool: 'Presentation generation',
  GeneratePdfTool: 'PDF generation',
  GenerateDocxTool: 'Document generation',
  GenerateDesignTool: 'Design generation',
}

/**
 * WebSearchTool's own output is the plain-text block it hands back to the MODEL
 * (numbered results, a one-line summary each) — see its formatResults()/PHP side.
 * Counting numbered lines here is a cheap, dependency-free way to turn that into
 * "Found 5 sources" without parsing it into a structured shape just for a status line.
 */
function resultSummary(output?: string): string {
  if (!output) return 'Search complete'
  const count = (output.match(/^\d+\.\s/gm) ?? []).length
  return count > 0 ? `Found ${count} source${count === 1 ? '' : 's'}` : 'Search complete'
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
