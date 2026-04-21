// DocStructureTab.tsx
// Generalized document intelligence renderer.
// Replaces OAStructureTab.tsx — handles all 14 doc types from the envelope schema.
//
// Place in: src/components/DocStructureTab.tsx
// Update EntityDetailPanel.tsx:
//   - Replace: import OAStructureTab from './OAStructureTab'
//   + Add:     import DocStructureTab from './DocStructureTab'
//   - Replace: <OAStructureTab documentId={node.id} />
//   + Add:     <DocStructureTab documentId={node.id} />
//   - Update isOADoc to cover all extractable types:
//     const isExtractableDoc = node.type === 'DOCUMENT'

import { useEffect, useState } from 'react'
import {
  Box, Typography, Chip, Divider, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableRow, TableCell,
  Alert, Tooltip, IconButton, Stack,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocMeta {
  document_title: string | null
  property_name: string | null
  effective_date: string | null
  execution_date: string | null
  governing_law: string | null
}

interface DocParty {
  name: string
  role: string
  notes: string | null
}

interface KeyDate {
  label: string
  date: string | null
  notes: string | null
}

interface DocStructure {
  doc_type: string
  meta: DocMeta
  parties: DocParty[]
  terms: Record<string, unknown>
  key_dates: KeyDate[]
  flags: string[]
}

interface DocStructureResponse {
  document_id: string
  filename: string | null
  doc_type: string
  structure: DocStructure | null
  pending?: boolean
  message?: string
}

// ---------------------------------------------------------------------------
// Config — display labels and role colors per doc type
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  LOAN_AGREEMENT:    'Loan Agreement',
  GUARANTY:          'Guaranty',
  MGMT_AGREEMENT:    'Management Agreement',
  CONSENT_AMENDMENT: 'Consent / Amendment',
  FRANCHISE:         'Franchise Agreement',
  DEED_OF_TRUST:     'Deed of Trust',
  DACA:              'DACA',
  ASSIGNMENT:        'Assignment',
  UCC_FILING:        'UCC Filing',
  CLOSING_DOC:       'Closing Document',
  TITLE_SURVEY:      'Title / Survey',
  ENVIRONMENTAL:     'Environmental',
  SNDA:              'SNDA',
  INSURANCE:         'Insurance',
  LP_AGREEMENT:      'LP Agreement',
  OPERATING_AGREEMENT: 'Operating Agreement',
}

const ROLE_COLORS: Record<string, string> = {
  BORROWER:        '#378add',
  LENDER:          '#5f5e5a',
  GUARANTOR:       '#e24b4a',
  MANAGER:         '#ef9f27',
  FRANCHISOR:      '#7b68ee',
  FRANCHISEE:      '#1d9e75',
  TRUSTEE:         '#888780',
  BENEFICIARY:     '#d4537e',
  ASSIGNOR:        '#ba7517',
  ASSIGNEE:        '#0f6e56',
  GENERAL_PARTNER: '#7b68ee',
  LIMITED_PARTNER: '#378add',
  HOTEL_OWNER:     '#1d9e75',
  PROPERTY_MANAGER:'#ef9f27',
  TENANT:          '#5dcaa5',
  LANDLORD:        '#d85a30',
  OTHER:           '#5f5e5a',
}

// Fields to hide from the generic terms renderer (shown in dedicated sections)
const SKIP_TERM_KEYS = new Set(['doc_type'])

// Human-readable term labels
const TERM_LABELS: Record<string, string> = {
  loan_amount:                    'Loan amount',
  loan_type:                      'Loan type',
  maturity_date:                  'Maturity date',
  initial_term_months:            'Initial term',
  amortization:                   'Amortization',
  prepayment:                     'Prepayment',
  recourse:                       'Recourse',
  ltv_at_closing_pct:             'LTV at closing',
  dscr_covenant_minimum:          'DSCR covenant',
  cash_management:                'Cash management',
  loan_fee_pct:                   'Loan fee',
  exit_fee_pct:                   'Exit fee',
  guaranty_type:                  'Guaranty type',
  guaranteed_amount:              'Guaranteed amount',
  joint_and_several:              'Joint & several',
  burn_off_date:                  'Burn-off date',
  cap_on_liability:               'Liability cap',
  management_fee_pct:             'Management fee',
  management_fee_floor_monthly:   'Fee floor/mo',
  accounting_fee_monthly:         'Accounting fee/mo',
  term_years:                     'Term',
  termination_without_cause_notice_days: 'No-cause notice',
  termination_fee:                'Termination fee',
  ff_and_e_reserve_pct:           'FF&E reserve',
  brand:                          'Brand',
  hotel_name:                     'Hotel',
  amendment_number:               'Amendment #',
  base_document_type:             'Amends',
  base_document_date:             'Base doc date',
  purpose:                        'Purpose',
  amendment_fee:                  'Amendment fee',
  waiver_of_default:              'Waiver of default',
  royalty_fee_pct:                'Royalty fee',
  marketing_fee_pct:              'Marketing fee',
  reservation_fee_pct:            'Reservation fee',
  total_fee_pct:                  'Total brand fees',
  license_term_years:             'License term',
  expiry_date:                    'Expiry',
  pip_required:                   'PIP required',
  pip_deadline:                   'PIP deadline',
  pip_estimated_cost:             'PIP est. cost',
  key_money:                      'Key money',
  secured_amount:                 'Secured amount',
  property_address:               'Property address',
  county:                         'County',
  state:                          'State',
  recording_date:                 'Recording date',
  bank_name:                      'Bank',
  account_type:                   'Account type',
  activation_trigger:             'Activation',
  assignment_type:                'Assignment type',
  assigned_interest_pct:          'Interest assigned',
  filing_state:                   'Filing state',
  filing_date:                    'Filing date',
  closing_date:                   'Closing date',
  purchase_price:                 'Purchase price',
  net_proceeds_to_seller:         'Net to seller',
  title_company:                  'Title company',
  policy_amount:                  'Policy amount',
  coverage_amount:                'Coverage amount',
  carrier:                        'Carrier',
  annual_premium:                 'Annual premium',
  deductible:                     'Deductible',
  policy_period_end:              'Policy expires',
  env_doc_subtype:                'Sub-type',
  remediation_required:           'Remediation req.',
  remediation_cost_estimate:      'Remediation est.',
  insurance_type:                 'Insurance type',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtValue(val: unknown): string | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'number') {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
    if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`
    return String(val)
  }
  if (typeof val === 'string') return val || null
  return null
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="overline" sx={{
      color: 'text.disabled', fontSize: '0.6rem', letterSpacing: 1.2,
      display: 'block', mt: 1.5, mb: 0.5,
    }}>
      {children}
    </Typography>
  )
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mr: 1 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ textAlign: 'right', color: 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}

function FlagRow({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
      <WarningAmberIcon sx={{ fontSize: 13, color: '#ef9f27', mt: 0.2, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: '#ef9f27', lineHeight: 1.4 }}>{text}</Typography>
    </Box>
  )
}

function PartyCard({ party }: { party: DocParty }) {
  const color = ROLE_COLORS[party.role] ?? ROLE_COLORS.OTHER
  return (
    <Box sx={{
      border: '1px solid', borderColor: 'divider',
      borderLeft: `3px solid ${color}`,
      borderRadius: 1, p: 1, mb: 0.75,
      bgcolor: 'background.default',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.3, flex: 1 }}>
          {party.name}
        </Typography>
        <Chip
          label={party.role.replace(/_/g, ' ')}
          size="small"
          sx={{
            height: 15, fontSize: '0.58rem', flexShrink: 0,
            bgcolor: `${color}22`, color, border: `1px solid ${color}44`,
          }}
        />
      </Box>
      {party.notes && (
        <Typography variant="caption" color="text.disabled" display="block"
          sx={{ fontStyle: 'italic', mt: 0.25 }}>
          {party.notes}
        </Typography>
      )}
    </Box>
  )
}

function KeyDateRow({ kd }: { kd: KeyDate }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3,
      borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
      <Typography variant="caption" color="text.secondary">{kd.label}</Typography>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="caption" sx={{ fontWeight: 500 }}>{kd.date ?? '—'}</Typography>
        {kd.notes && (
          <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.6rem' }}>
            {kd.notes}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// Generic terms table — renders whatever scalar key/values are in terms
function TermsTable({ terms }: { terms: Record<string, unknown> }) {
  const rows = Object.entries(terms).filter(([k, v]) => {
    if (SKIP_TERM_KEYS.has(k)) return false
    if (v === null || v === undefined || v === '') return false
    if (Array.isArray(v)) return false
    if (typeof v === 'object') return false
    return true
  })
  if (rows.length === 0) return null
  return (
    <Table size="small" sx={{ tableLayout: 'fixed' }}>
      <TableBody>
        {rows.map(([k, v]) => {
          const display = fmtValue(v)
          if (!display) return null
          return (
            <TableRow key={k} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 0.4, px: 0.75, width: '45%' }}>
                <Typography variant="caption" color="text.secondary">
                  {TERM_LABELS[k] ?? k.replace(/_/g, ' ')}
                </Typography>
              </TableCell>
              <TableCell sx={{ py: 0.4, px: 0.75 }}>
                <Typography variant="caption">{display}</Typography>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

// Renders array fields from terms (carve-outs, conditions, changes, etc.)
function TermsArrays({ terms }: { terms: Record<string, unknown> }) {
  const arrays = Object.entries(terms).filter(([k, v]) =>
    !SKIP_TERM_KEYS.has(k) && Array.isArray(v) && (v as unknown[]).length > 0
  )
  if (arrays.length === 0) return null
  return (
    <>
      {arrays.map(([k, v]) => {
        const items = v as unknown[]
        const label = TERM_LABELS[k] ?? k.replace(/_/g, ' ')
        // Special case: changes array (consent/amendment)
        if (k === 'changes' && typeof items[0] === 'object') {
          return (
            <Box key={k} sx={{ mt: 1 }}>
              <SectionLabel>Changes</SectionLabel>
              {items.map((item: any, i) => (
                <Box key={i} sx={{
                  border: '1px solid', borderColor: 'divider',
                  borderLeft: '3px solid #ef9f27', borderRadius: 1,
                  p: 0.75, mb: 0.5, bgcolor: 'background.default',
                }}>
                  {item.section && (
                    <Typography variant="caption" color="text.disabled" display="block">
                      {item.section}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ fontWeight: 600 }} display="block">
                    {item.field_changed ?? 'Change'}
                  </Typography>
                  {item.old_value && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Was: {item.old_value}
                    </Typography>
                  )}
                  {item.new_value && (
                    <Typography variant="caption" sx={{ color: '#1d9e75' }} display="block">
                      Now: {item.new_value}
                    </Typography>
                  )}
                  {item.notes && (
                    <Typography variant="caption" color="text.disabled" display="block"
                      sx={{ fontStyle: 'italic' }}>
                      {item.notes}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )
        }
        // Extension options
        if (k === 'extension_options' && typeof items[0] === 'object') {
          return (
            <Box key={k} sx={{ mt: 0.5 }}>
              <SectionLabel>Extension options</SectionLabel>
              {items.map((item: any, i) => (
                <Box key={i} sx={{ py: 0.25 }}>
                  <Typography variant="caption">
                    Option {item.number}: {item.term_months}mo
                    {item.conditions ? ` — ${item.conditions}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )
        }
        // Simple string arrays
        if (typeof items[0] === 'string') {
          return (
            <Box key={k} sx={{ mt: 0.5 }}>
              <SectionLabel>{label}</SectionLabel>
              {items.map((item, i) => (
                <Typography key={i} variant="caption" display="block"
                  sx={{ py: 0.15, color: 'text.secondary' }}>
                  • {String(item)}
                </Typography>
              ))}
            </Box>
          )
        }
        return null
      })}
    </>
  )
}

// Nested object fields (interest_rate, performance_test, etc.)
function TermsObjects({ terms }: { terms: Record<string, unknown> }) {
  const objects = Object.entries(terms).filter(([k, v]) =>
    !SKIP_TERM_KEYS.has(k) && v !== null && typeof v === 'object' && !Array.isArray(v)
  )
  if (objects.length === 0) return null
  return (
    <>
      {objects.map(([k, obj]) => {
        const label = TERM_LABELS[k] ?? k.replace(/_/g, ' ')
        const entries = Object.entries(obj as Record<string, unknown>)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
        if (entries.length === 0) return null
        return (
          <Box key={k} sx={{ mt: 0.75 }}>
            <SectionLabel>{label}</SectionLabel>
            {entries.map(([ek, ev]) => (
              <KV key={ek}
                label={TERM_LABELS[ek] ?? ek.replace(/_/g, ' ')}
                value={fmtValue(ev)}
              />
            ))}
          </Box>
        )
      })}
    </>
  )
}

function Section({
  label, defaultExpanded = true, children,
}: { label: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  return (
    <Accordion disableGutters defaultExpanded={defaultExpanded} elevation={0}
      sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: 15 }} />}
        sx={{ px: 0, minHeight: 28, '& .MuiAccordionSummary-content': { my: 0 } }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.5, fontSize: '0.65rem' }}>
          {label}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props { documentId: string }

export default function DocStructureTab({ documentId }: Props) {
  const [data, setData]       = useState<DocStructureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [copied, setCopied]   = useState(false)

  useEffect(() => {
    if (!documentId) return
    setLoading(true)
    setError(null)
    fetch(`/api/documents/${documentId}/structure`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: DocStructureResponse) => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e.message)); setLoading(false) })
  }, [documentId])

  const handleCopy = () => {
    if (!data?.structure) return
    navigator.clipboard.writeText(JSON.stringify(data.structure, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
      <CircularProgress size={22} />
    </Box>
  )
  if (error) return (
    <Alert severity="error" sx={{ m: 1, fontSize: '0.72rem' }}>{error}</Alert>
  )
  if (!data?.structure) return (
    <Box sx={{ p: 2 }}>
      {data?.pending && data?.raw_text ? (
        <>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mb: 1 }}>
            Structure extraction pending — showing raw content
          </Typography>
          <Box sx={{
            bgcolor: 'background.default',
            border: '1px solid', borderColor: 'divider',
            borderRadius: 1, p: 1.5,
            maxHeight: 400, overflowY: 'auto',
          }}>
            <Typography variant="caption" sx={{
              fontSize: '0.7rem', whiteSpace: 'pre-wrap',
              fontFamily: 'monospace', color: 'text.secondary',
              lineHeight: 1.6,
            }}>
              {data.raw_text}
            </Typography>
          </Box>
        </>
      ) : (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.disabled">
            {data?.pending
              ? 'Structure extraction pending — run ingest to process.'
              : 'No structure extracted yet.'}
          </Typography>
        </Box>
      )}
    </Box>
  )

  const { structure } = data
  // Null-safe destructure — early extractions used 'deal' instead of 'meta'
  const doc_type   = structure.doc_type ?? 'OTHER'
  const meta       = structure.meta ?? (structure as any).deal ?? {}
  const parties    = structure.parties ?? []
  const terms      = structure.terms ?? {}
  const key_dates  = structure.key_dates ?? []
  const flags      = structure.flags ?? []
  const typeLabel  = DOC_TYPE_LABELS[doc_type] ?? doc_type

  return (
    <Box sx={{ px: 1.5, pb: 3 }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 0.5 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip label={typeLabel} size="small" sx={{
              height: 16, fontSize: '0.6rem',
              bgcolor: 'rgba(127,119,221,0.15)', color: '#9d8fee',
              border: '1px solid rgba(127,119,221,0.3)',
            }} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3, mt: 0.5 }}>
            {meta.property_name ?? meta.document_title ?? typeLabel}
          </Typography>
          {meta.property_name && meta.document_title && meta.document_title !== meta.property_name && (
            <Typography variant="caption" color="text.secondary" display="block">
              {meta.document_title}
            </Typography>
          )}
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy JSON'}>
          <IconButton size="small" onClick={handleCopy} sx={{ p: 0.25 }}>
            <ContentCopyIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Meta */}
      <Box sx={{ mt: 0.75 }}>
        <KV label="Effective"     value={meta.effective_date} />
        <KV label="Executed"      value={meta.execution_date} />
        <KV label="Governing law" value={meta.governing_law} />
      </Box>

      {/* Flags */}
      {flags.length > 0 && (
        <>
          <SectionLabel>Review flags</SectionLabel>
          {flags.map((f, i) => <FlagRow key={i} text={f} />)}
        </>
      )}

      <Divider sx={{ my: 1 }} />

      {/* Parties */}
      {parties.length > 0 && (
        <>
          <Section label={`PARTIES (${parties.length})`}>
            {parties.map((p, i) => <PartyCard key={i} party={p} />)}
          </Section>
          <Divider sx={{ my: 0.25 }} />
        </>
      )}

      {/* Key dates */}
      {key_dates.length > 0 && (
        <>
          <Section label="KEY DATES">
            {key_dates.map((kd, i) => <KeyDateRow key={i} kd={kd} />)}
          </Section>
          <Divider sx={{ my: 0.25 }} />
        </>
      )}

      {/* Terms — scalars, objects, arrays */}
      {Object.keys(terms).length > 0 && (
        <Section label="TERMS">
          <TermsTable terms={terms} />
          <TermsObjects terms={terms} />
          <TermsArrays terms={terms} />
        </Section>
      )}

    </Box>
  )
}
