// DealDetailPanel.tsx
// Full rewrite — adds Meetings, Documents, Property Card, STR Card sections
// Requires: /api/deal-intelligence/{deal_id} endpoint added to main.py

import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Chip, Divider, IconButton, Tooltip,
  Skeleton, Accordion, AccordionSummary, AccordionDetails,
  Paper, Grid, Stack, CircularProgress, Avatar,
  Table, TableBody, TableRow, TableCell,
} from "@mui/material";
import OpenInNewIcon          from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon         from "@mui/icons-material/ExpandMore";
import ArticleIcon            from "@mui/icons-material/Article";
import VideocamIcon           from "@mui/icons-material/Videocam";
import BusinessIcon           from "@mui/icons-material/Business";
import PeopleIcon             from "@mui/icons-material/People";
import HotelIcon              from "@mui/icons-material/Hotel";
import BarChartIcon           from "@mui/icons-material/BarChart";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import FolderOpenIcon         from "@mui/icons-material/FolderOpen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Meeting {
  meeting_id: number | string;
  title: string;
  started_at: string;
  summary: string;
  action_items: string[];
  attendee_count: number;
  attendees: string[];
}

interface DealDocument {
  document_id: string;
  filename: string;
  doc_type: string;
  extracted: boolean;
  predicate: string;
  via_property?: string;
  created_at: string;
  structure_summary?: Record<string, unknown>;
  source?: string;
}

interface PropertyCard {
  hotel_name?: string;
  location?: string;
  city?: string;
  state?: string;
  brand?: string;
  keys?: number | string;
  year_built?: number | string;
  year_reno?: number | string;
  scale?: string;
  loan_amount?: number | string;
  ltv?: number | string;
  rate?: number | string;
  term?: string;
}

interface StrCard {
  occupancy?: number | string;
  adr?: number | string;
  revpar?: number | string;
  comp_occupancy?: number | string;
  comp_adr?: number | string;
  comp_revpar?: number | string;
  mpi?: number | string;
  ari?: number | string;
  rgi?: number | string;
  period?: string;
  comp_set?: string | string[];
}

interface DealIntelligence {
  deal_id: string;
  meetings: Meeting[];
  documents: DealDocument[];
  property_card: PropertyCard | null;
  str_card: StrCard | null;
}

interface DealNode {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  status?: string;
  pipeline_stage?: string;
}

interface Relationship {
  direction: "inbound" | "outbound";
  predicate: string;
  neighbor_id: string;
  neighbor_type: string;
  neighbor_name: string;
  source?: string;
  confidence_tier?: string;
}

interface KgAskResult {
  node: DealNode;
  relationships: Relationship[];
  documents: DealDocument[];
  notes: unknown[];
  deal_model?: Record<string, unknown>;
  summary: { relationship_count: number; document_count: number; note_count: number };
}

interface DealDetailPanelProps {
  nodeId: string;
  onClose?: () => void;
  onNodeClick?: (nodeId: string) => void;
  apiBase?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";

const DOC_TYPE_COLORS: Record<string, string> = {
  TERM_SHEET:     "#4CAF50",
  IC_MEMO:        "#2196F3",
  BROKER_DD:      "#FF9800",
  INTERNAL_DD:    "#9C27B0",
  LEGAL:          "#F44336",
  MODEL:          "#00BCD4",
  STR:            "#3F51B5",
  FRANCHISE:      "#795548",
  MGMT_AGREEMENT: "#607D8B",
  CLOSING_DOC:    "#E91E63",
  DOCUMENT:       "#757575",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  EXPLICIT:    "#4CAF50",
  CONTRIBUTED: "#FF9800",
  INFERRED:    "#9E9E9E",
};

const PREDICATE_LABELS: Record<string, string> = {
  FINANCED_BY:     "Lenders",
  OWNED_BY:        "Owners",
  MEMBER_OF:       "Sponsor",
  ASSOCIATED_WITH: "Associated",
  GUARANTOR_FOR:   "Guarantor",
  AGENT_FOR:       "Agent",
  MANAGES:         "Manager",
  EMPLOYED_BY:     "Employed By",
  DESIGNED:        "Architect",
};

const PREDICATE_ORDER = [
  "FINANCED_BY", "OWNED_BY", "MEMBER_OF", "GUARANTOR_FOR",
  "ASSOCIATED_WITH", "AGENT_FOR", "MANAGES",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return s; }
}

function fmtCurrency(v: number | string | undefined): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) : Number(v);
  if (isNaN(n)) return String(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(v: number | string | undefined): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  if (isNaN(n)) return String(v);
  return n < 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
}

function fmtVal(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function groupByPredicate(rels: Relationship[]): Record<string, Relationship[]> {
  const groups: Record<string, Relationship[]> = {};
  for (const r of rels) {
    if (!groups[r.predicate]) groups[r.predicate] = [];
    groups[r.predicate].push(r);
  }
  return groups;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
      <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", color: "text.secondary" }}>
        {title}
      </Typography>
      {count !== undefined && count > 0 && (
        <Chip label={count} size="small" sx={{ height: 17, fontSize: "0.62rem", bgcolor: "rgba(255,255,255,0.07)", color: "text.secondary" }} />
      )}
    </Stack>
  );
}

function PropertyCardSection({ card }: { card: PropertyCard }) {
  const rows: [string, string][] = ([
    ["Hotel",            fmtVal(card.hotel_name)],
    ["Location",         card.city && card.state ? `${card.city}, ${card.state}` : fmtVal(card.location || card.city)],
    ["Brand / Chain",    fmtVal(card.brand)],
    ["Keys / Rooms",     fmtVal(card.keys)],
    ["Year Built",       fmtVal(card.year_built)],
    ["Last Renovation",  fmtVal(card.year_reno)],
    ["Chain Scale",      fmtVal(card.scale)],
    ["Loan Amount",      card.loan_amount ? fmtCurrency(card.loan_amount) : "—"],
    ["LTV",              card.ltv ? fmtPct(card.ltv) : "—"],
    ["Rate",             card.rate ? fmtPct(card.rate) : "—"],
    ["Term",             fmtVal(card.term)],
  ] as [string, string][]).filter(([, v]) => v !== "—");

  if (rows.length === 0) return null;
  return (
    <Box mb={3}>
      <SectionHeader icon={<HotelIcon sx={{ fontSize: 16 }} />} title="Property" />
      <Paper elevation={0} sx={{ bgcolor: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        <Table size="small">
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label} sx={{ "&:last-child td": { border: 0 } }}>
                <TableCell sx={{ color: "text.secondary", fontSize: "0.72rem", py: 0.7, pl: 2, border: "none", width: "42%", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {label}
                </TableCell>
                <TableCell sx={{ color: "text.primary", fontSize: "0.78rem", fontWeight: 500, py: 0.7, border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

function StrCardSection({ card }: { card: StrCard }) {
  const metrics: [string, string][] = ([
    ["Occupancy", card.occupancy ? fmtPct(card.occupancy)         : "—"],
    ["ADR",       card.adr      ? `$${Number(card.adr).toFixed(0)}` : "—"],
    ["RevPAR",    card.revpar   ? `$${Number(card.revpar).toFixed(0)}` : "—"],
  ] as [string, string][]).filter(([, v]) => v !== "—");

  const indexes: [string, string][] = ([
    ["MPI", fmtVal(card.mpi)],
    ["ARI", fmtVal(card.ari)],
    ["RGI", fmtVal(card.rgi)],
  ] as [string, string][]).filter(([, v]) => v !== "—");

  if (metrics.length === 0 && indexes.length === 0) return null;
  return (
    <Box mb={3}>
      <SectionHeader icon={<BarChartIcon sx={{ fontSize: 16 }} />} title="STR Performance" />
      {card.period && <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>Period: {fmtVal(card.period)}</Typography>}
      <Grid container spacing={1} mb={indexes.length > 0 ? 1 : 0}>
        {metrics.map(([label, value]) => (
          <Grid item xs={4} key={label}>
            <Paper elevation={0} sx={{ bgcolor: "rgba(33,150,243,0.07)", border: "1px solid rgba(33,150,243,0.18)", borderRadius: 2, p: 1.5, textAlign: "center" }}>
              <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: "#42A5F5" }}>{value}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      {indexes.length > 0 && (
        <Grid container spacing={1}>
          {indexes.map(([label, value]) => (
            <Grid item xs={4} key={label}>
              <Paper elevation={0} sx={{ bgcolor: "rgba(255,255,255,0.04)", borderRadius: 1.5, p: 1, textAlign: "center" }}>
                <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "text.primary" }}>{value}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.62rem" }}>{label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
      {card.comp_set && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
          Comp set: {Array.isArray(card.comp_set) ? card.comp_set.join(", ") : card.comp_set}
        </Typography>
      )}
    </Box>
  );
}

function RelationshipsSection({ relationships, onNodeClick }: { relationships: Relationship[]; onNodeClick?: (id: string) => void }) {
  if (relationships.length === 0) return null;
  const groups = groupByPredicate(relationships);
  const ordered = [
    ...PREDICATE_ORDER.filter(k => groups[k]),
    ...Object.keys(groups).filter(k => !PREDICATE_ORDER.includes(k)),
  ].slice(0, 10);

  return (
    <Box mb={3}>
      <SectionHeader icon={<BusinessIcon sx={{ fontSize: 16 }} />} title="Capital Stack & Relationships" count={relationships.length} />
      <Stack spacing={1.5}>
        {ordered.map(predicate => (
          <Box key={predicate}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.07em", mb: 0.5 }}>
              {PREDICATE_LABELS[predicate] || predicate.replace(/_/g, " ")}
            </Typography>
            <Stack spacing={0.5}>
              {groups[predicate].slice(0, 6).map(rel => (
                <Stack key={rel.neighbor_id} direction="row" alignItems="center" spacing={1}
                  sx={{ cursor: onNodeClick ? "pointer" : "default", borderRadius: 1, py: 0.25,
                    "&:hover": onNodeClick ? { bgcolor: "rgba(255,255,255,0.04)" } : {} }}
                  onClick={() => onNodeClick?.(rel.neighbor_id)}>
                  <Avatar sx={{ width: 20, height: 20, fontSize: "0.55rem", bgcolor: rel.neighbor_type === "PERSON" ? "rgba(103,58,183,0.7)" : "rgba(21,101,192,0.7)" }}>
                    {rel.neighbor_type === "PERSON" ? rel.neighbor_name[0]?.toUpperCase() : <BusinessIcon sx={{ fontSize: 11 }} />}
                  </Avatar>
                  <Typography sx={{ flex: 1, color: "text.primary", fontSize: "0.75rem" }}>
                    {rel.neighbor_name}
                  </Typography>
                  {rel.confidence_tier && (
                    <Tooltip title={`${rel.confidence_tier} — ${rel.source || ""}`}>
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: CONFIDENCE_COLORS[rel.confidence_tier] || "#757575", flexShrink: 0 }} />
                    </Tooltip>
                  )}
                </Stack>
              ))}
              {groups[predicate].length > 6 && (
                <Typography sx={{ color: "text.secondary", pl: 3.5, fontSize: "0.65rem" }}>+{groups[predicate].length - 6} more</Typography>
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function MeetingsSection({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) return null;
  return (
    <Box mb={3}>
      <SectionHeader icon={<VideocamIcon sx={{ fontSize: 16 }} />} title="Meetings" count={meetings.length} />
      <Stack spacing={1}>
        {meetings.map(m => (
          <Paper key={m.meeting_id} elevation={0} sx={{
            bgcolor: "rgba(255,255,255,0.04)", borderRadius: 2, p: 1.5,
            border: "1px solid rgba(255,255,255,0.06)",
            transition: "background 0.15s",
            "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography sx={{ fontWeight: 600, fontSize: "0.78rem", color: "text.primary", flex: 1, mr: 1, lineHeight: 1.3 }}>
                {m.title}
              </Typography>
              <Typography sx={{ color: "text.secondary", whiteSpace: "nowrap", fontSize: "0.65rem" }}>
                {fmtDate(m.started_at)}
              </Typography>
            </Stack>
            {m.summary && (
              <Typography sx={{
                color: "text.secondary", display: "block", mt: 0.5, fontSize: "0.72rem", lineHeight: 1.45,
                overflow: "hidden", display: "-webkit-box" as unknown as string,
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as unknown as string,
              }}>
                {m.summary}
              </Typography>
            )}
            <Stack direction="row" spacing={0.75} mt={0.75} flexWrap="wrap">
              {m.attendee_count > 0 && (
                <Chip icon={<PeopleIcon sx={{ fontSize: "0.7rem !important" }} />}
                  label={`${m.attendee_count} attendees`} size="small"
                  sx={{ height: 17, fontSize: "0.62rem", bgcolor: "rgba(255,255,255,0.06)" }} />
              )}
              {m.action_items.length > 0 && (
                <Chip icon={<CheckCircleOutlineIcon sx={{ fontSize: "0.7rem !important" }} />}
                  label={`${m.action_items.length} action${m.action_items.length > 1 ? "s" : ""}`} size="small"
                  sx={{ height: 17, fontSize: "0.62rem", bgcolor: "rgba(76,175,80,0.1)", color: "#66BB6A" }} />
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

function DocumentsSection({ documents }: { documents: DealDocument[] }) {
  if (documents.length === 0) return null;

  const TYPE_ORDER = ["TERM_SHEET", "IC_MEMO", "BROKER_DD", "INTERNAL_DD", "STR", "LEGAL", "MODEL", "FRANCHISE", "MGMT_AGREEMENT", "CLOSING_DOC", "DOCUMENT"];
  const groups: Record<string, DealDocument[]> = {};
  for (const doc of documents) {
    const t = (doc.doc_type || "DOCUMENT").toUpperCase();
    if (!groups[t]) groups[t] = [];
    groups[t].push(doc);
  }
  const ordered = [...TYPE_ORDER.filter(k => groups[k]), ...Object.keys(groups).filter(k => !TYPE_ORDER.includes(k))];
  const typeLabel = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Box mb={3}>
      <SectionHeader icon={<FolderOpenIcon sx={{ fontSize: 16 }} />} title="Documents" count={documents.length} />
      <Stack spacing={0.5}>
        {ordered.map(type => (
          <Accordion key={type} disableGutters elevation={0} defaultExpanded={TYPE_ORDER.indexOf(type) < 4} sx={{
            bgcolor: "transparent",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "8px !important",
            "&:before": { display: "none" },
            "&.Mui-expanded": { borderColor: "rgba(255,255,255,0.1)" },
            mb: 0.5,
          }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 15, color: "text.secondary" }} />}
              sx={{ minHeight: 34, py: 0, px: 1.5, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: DOC_TYPE_COLORS[type] || "#757575", flexShrink: 0 }} />
                <Typography sx={{ fontWeight: 600, color: "text.primary", fontSize: "0.72rem" }}>{typeLabel(type)}</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: "0.62rem" }}>({groups[type].length})</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pb: 1, pt: 0 }}>
              <Stack spacing={0.25}>
                {groups[type].map(doc => (
                  <Stack key={doc.document_id} direction="row" alignItems="center" spacing={0.75}
                    sx={{ py: 0.4, px: 0.75, borderRadius: 1, "&:hover": { bgcolor: "rgba(255,255,255,0.04)" } }}>
                    <ArticleIcon sx={{ fontSize: 13, color: DOC_TYPE_COLORS[type] || "#757575", flexShrink: 0 }} />
                    <Typography sx={{ color: "text.secondary", flex: 1, fontSize: "0.7rem",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.filename}
                    </Typography>
                    {doc.via_property && (
                      <Tooltip title={`Via property: ${doc.via_property}`}>
                        <Chip label="↑prop" size="small" sx={{ height: 13, fontSize: "0.55rem", bgcolor: "rgba(255,255,255,0.05)" }} />
                      </Tooltip>
                    )}
                    {doc.extracted && (
                      <Tooltip title="Text extracted">
                        <CheckCircleOutlineIcon sx={{ fontSize: 12, color: "#66BB6A" }} />
                      </Tooltip>
                    )}
                  </Stack>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DealDetailPanel({ nodeId, onClose, onNodeClick, apiBase = API_BASE }: DealDetailPanelProps) {
  const [kgData, setKgData]             = useState<KgAskResult | null>(null);
  const [intel, setIntel]               = useState<DealIntelligence | null>(null);
  const [loadingKg, setLoadingKg]       = useState(true);
  const [loadingIntel, setLoadingIntel] = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!nodeId) return;
    setLoadingKg(true);
    setLoadingIntel(true);
    setError(null);
    setKgData(null);
    setIntel(null);

    const [kgRes, intelRes] = await Promise.allSettled([
      fetch(`${apiBase}/api/deals/${nodeId}`).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
      fetch(`${apiBase}/api/deal-intelligence/${nodeId}`).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    ]);

    if (kgRes.status === "fulfilled") {
      // /api/deals/ returns flat object — map to KgAskResult shape
      const d = kgRes.value;
      setKgData({
        node: {
          id:             d.deal_id,
          name:           d.name,
          type:           "DEAL",
          subtype:        d.deal_type,
          status:         d.status,
          pipeline_stage: d.pipeline_stage ?? null,
        },
        relationships: [],
        documents:     [],
        notes:         [],
        deal_model:    d.uw_model ?? null,
        summary: {
          relationship_count: 0,
          document_count:     0,
          note_count:         0,
        },
      });
    } else {
      setError("Failed to load deal — check API connection");
    }
    setLoadingKg(false);

    if (intelRes.status === "fulfilled") {
      setIntel(intelRes.value);
    }
    setLoadingIntel(false);
  }, [nodeId, apiBase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const deal = kgData?.node;
  const relationships = kgData?.relationships || [];

  const statusColor = (s?: string) => {
    const m: Record<string, string> = { PIPELINE: "#FF9800", ACTIVE: "#4CAF50", CLOSED: "#9E9E9E", DEAD: "#F44336" };
    return m[(s || "").toUpperCase()] || "#757575";
  };
  const subtypeColor = (s?: string) => {
    const m: Record<string, string> = {
      CREDIT: "#0D47A1", SINGLE_ASSET: "#1B5E20", DEVELOPMENT: "#E65100",
      EQUITY_ROLLUP: "#4A148C", FUND: "#880E4F", PORTFOLIO: "#4A148C",
    };
    return m[(s || "").toUpperCase()] || "#1565C0";
  };

  return (
    <Box sx={{
      height: "100%", overflowY: "auto", p: 2,
      "&::-webkit-scrollbar": { width: 4 },
      "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.12)", borderRadius: 2 },
    }}>

      {/* Header */}
      {loadingKg ? (
        <Box>
          <Skeleton variant="text" width="70%" height={28} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
          <Skeleton variant="text" width="40%" height={20} sx={{ bgcolor: "rgba(255,255,255,0.06)", mt: 0.5 }} />
          <Stack direction="row" spacing={1} mt={1}>
            {[60, 80, 50].map(w => <Skeleton key={w} variant="rectangular" width={w} height={20} sx={{ bgcolor: "rgba(255,255,255,0.06)", borderRadius: 10 }} />)}
          </Stack>
        </Box>
      ) : error ? (
        <Typography color="error" variant="body2">{error}</Typography>
      ) : deal ? (
        <Box mb={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", color: "text.primary", lineHeight: 1.3, flex: 1, mr: 1 }}>
              {deal.name}
            </Typography>
            <Tooltip title="Open in graph">
              <IconButton size="small" sx={{ color: "text.secondary" }}
                onClick={() => window.open(`http://localhost:5173/?focus=${nodeId}`, "_blank")}>
                <OpenInNewIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Stack>

          <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" gap={0.5}>
            {deal.subtype && (
              <Chip label={deal.subtype} size="small" sx={{ bgcolor: subtypeColor(deal.subtype), color: "#fff", fontSize: "0.62rem", height: 19, fontWeight: 600 }} />
            )}
            {deal.status && (
              <Chip label={deal.status} size="small" sx={{
                bgcolor: `${statusColor(deal.status)}22`, color: statusColor(deal.status),
                border: `1px solid ${statusColor(deal.status)}44`, fontSize: "0.62rem", height: 19,
              }} />
            )}
            {deal.pipeline_stage && (
              <Chip label={deal.pipeline_stage} size="small" sx={{ bgcolor: "rgba(255,255,255,0.06)", color: "text.secondary", fontSize: "0.62rem", height: 19 }} />
            )}
          </Stack>

          {/* Summary counts */}
          <Stack direction="row" spacing={2.5} mt={1.5}>
            {[
              { label: "Relationships", val: kgData?.summary.relationship_count ?? 0, loading: false },
              { label: "Documents",     val: intel?.documents.length ?? 0, loading: loadingIntel },
              { label: "Meetings",      val: intel?.meetings.length ?? 0, loading: loadingIntel },
            ].map(({ label, val, loading }) => (
              <Box key={label} textAlign="center">
                {loading
                  ? <CircularProgress size={14} sx={{ display: "block", mx: "auto" }} />
                  : <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: "primary.main" }}>{val}</Typography>
                }
                <Typography sx={{ color: "text.secondary", fontSize: "0.6rem" }}>{label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mb: 2 }} />

      {/* Property Card */}
      {loadingIntel ? (
        <Box mb={3}>
          <Skeleton variant="text" width="40%" height={16} sx={{ bgcolor: "rgba(255,255,255,0.06)", mb: 1 }} />
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="rectangular" height={26} sx={{ bgcolor: "rgba(255,255,255,0.04)", borderRadius: 1, mb: 0.5 }} />)}
        </Box>
      ) : intel?.property_card ? (
        <PropertyCardSection card={intel.property_card} />
      ) : null}

      {/* STR Card */}
      {!loadingIntel && intel?.str_card && <StrCardSection card={intel.str_card} />}

      {/* Relationships */}
      {!loadingKg && <RelationshipsSection relationships={relationships} onNodeClick={onNodeClick} />}

      {/* Meetings */}
      {loadingIntel ? null : (
        <MeetingsSection meetings={intel?.meetings ?? []} />
      )}
      {!loadingIntel && (intel?.meetings ?? []).length === 0 && (
        <Box mb={3}>
          <SectionHeader icon={<VideocamIcon sx={{ fontSize: 16 }} />} title="Meetings" />
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>No meetings linked to this deal yet</Typography>
        </Box>
      )}

      {/* Documents */}
      {loadingIntel ? null : (
        <DocumentsSection documents={intel?.documents ?? []} />
      )}
      {!loadingIntel && (intel?.documents ?? []).length === 0 && (
        <Box mb={3}>
          <SectionHeader icon={<FolderOpenIcon sx={{ fontSize: 16 }} />} title="Documents" />
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.72rem" }}>No documents found for this deal</Typography>
        </Box>
      )}

    </Box>
  );
}
