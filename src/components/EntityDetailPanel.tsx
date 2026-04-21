import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Chip, Stack, Divider,
  CircularProgress, IconButton, Paper, Tabs, Tab,
} from '@mui/material'
import { CloseIcon } from '../icons'
import dayjs from 'dayjs'
import axios from 'axios'
import { fetchEmailDetail, fetchEmailSummary, fetchMeetings } from '../api'
import type { GraphNode, TimelineEvent, EmailDetail } from '../types'
import DocStructureTab from './DocStructureTab'
import DealDetailPanel from './DealDetailPanel'

const EXTRACTABLE_DOC_TYPES = [
  'LP_AGREEMENT','OPERATING_AGREEMENT','LOAN_AGREEMENT','GUARANTY',
  'MGMT_AGREEMENT','CONSENT_AMENDMENT','FRANCHISE','DEED_OF_TRUST',
  'DACA','ASSIGNMENT','UCC_FILING','CLOSING_DOC','TITLE_SURVEY',
  'ENVIRONMENTAL','SNDA','INSURANCE',
]

interface Relationship {
  predicate:   string
  object_id:   string
  object_type: string
  object_name: string
  asserted_at: string | null
  confidence:  number | null
}

// Contacts linked to a deal node via HubSpot
interface HsContact {
  node_id:            string
  name:               string
  hubspot_contact_id: string
}

interface Props {
  node:        GraphNode
  onClose:     () => void
  onNavigate:  (node: GraphNode) => void
  onEmailClick: (emailId: string) => void
}

const PREDICATE_COLORS: Record<string, string> = {
  EMPLOYED_BY:  '#AFA9EC',
  SENT_TO:      '#5DCAA5',
  GOVERNED_BY:  '#EF9F27',
  FINANCED_BY:  '#F09595',
  OWNS:         '#ED93B1',
  MANAGED_BY:   '#5DCAA5',
  REFERENCES:   '#888780',
  MENTIONS:     '#666',
}

const HS_CHIP_SX = {
  fontSize: '0.65rem', height: 18, cursor: 'pointer',
  bgcolor: 'rgba(255,122,0,0.15)', color: '#FF7A00',
  border: '1px solid rgba(255,122,0,0.3)',
}

export default function EntityDetailPanel({ node, onClose, onNavigate, onEmailClick }: Props) {
  const [emails, setEmails]             = useState<TimelineEvent[]>([])
  const [relationships, setRels]         = useState<Relationship[]>([])
  const [loadingEmails, setLoadingE]     = useState(true)
  const [loadingRels, setLoadingR]       = useState(true)
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null)
  const [emailSummary, setEmailSummary]   = useState<string | null>(null)
  const [emailActions, setEmailActions]   = useState<string[]>([])
  const [loadingEmail, setLoadingEmail]   = useState(false)
  const [meetings, setMeetings]           = useState<any[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null)
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [activeTab, setActiveTab]             = useState(0)
  // HubSpot contacts connected to this deal node (DEAL nodes only)
  const [hsContacts, setHsContacts]           = useState<HsContact[]>([])

  const isExtractableDoc = node.type === 'DOCUMENT'
  const isDeal = node.type === 'DEAL'

  const handleEmailClick = async (emailId: string) => {
    setLoadingEmail(true)
    setSelectedEmail(null)
    setEmailSummary(null)
    setEmailActions([])
    onEmailClick(emailId)
    try {
      const [detail, summary] = await Promise.all([
        fetchEmailDetail(emailId),
        fetchEmailSummary(emailId),
      ])
      setSelectedEmail(detail)
      setEmailSummary(summary.summary)
      setEmailActions(summary.action_items)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingEmail(false)
    }
  }

  // Reset to default tab when node changes
  useEffect(() => { setActiveTab(0) }, [node.id])

  useEffect(() => {
    setLoadingE(true)
    setLoadingR(true)
    setHsContacts([])

    // Fetch emails mentioning this entity
    axios.get('/api/timeline', { params: { entity_id: node.id, limit: 20 } })
      .then(r => setEmails(r.data))
      .catch(console.error)
      .finally(() => setLoadingE(false))

    // Fetch meetings this entity attended
    setLoadingMeetings(true)
    axios.get('/api/meetings/by-entity/' + node.id)
      .then(r => setMeetings(r.data))
      .catch(() => setMeetings([]))
      .finally(() => setLoadingMeetings(false))

    // Fetch subgraph to get relationships
    axios.get(`/api/graph/${node.id}`, { params: { hops: 1 } })
      .then(r => {
        const links: Relationship[] = []
        const nodeMap: Record<string, string> = {}

        // Build name lookup from nodes
        for (const n of r.data.nodes) {
          nodeMap[n.id] = n.name
        }

        for (const link of r.data.links) {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source
          const targetId = typeof link.target === 'object' ? link.target.id : link.target
          const targetType = r.data.nodes.find((n: any) =>
            (typeof link.target === 'object' ? link.target.id : link.target) === n.id
          )?.type ?? 'UNKNOWN'

          if (sourceId === node.id) {
            links.push({
              predicate:   link.predicate,
              object_id:   targetId,
              object_type: targetType,
              object_name: nodeMap[targetId] ?? targetId,
              asserted_at: link.asserted_at,
              confidence:  link.confidence,
            })
          }
        }
        // Deduplicate by predicate + object
        const seen = new Set<string>()
        const unique = links.filter(l => {
          const key = `${l.predicate}:${l.object_id}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setRels(unique)

        // For DEAL nodes: collect connected PERSON nodes that have a HubSpot record.
        // The 1-hop graph response already includes full node properties — no extra API call needed.
        if (node.type === 'DEAL') {
          const linked: HsContact[] = r.data.nodes
            .filter((n: any) => n.type === 'PERSON' && n.hubspot_contact_id)
            .map((n: any) => ({
              node_id:            n.id,
              name:               n.name,
              hubspot_contact_id: n.hubspot_contact_id,
            }))
          setHsContacts(linked)
        }
      })
      .catch(console.error)
      .finally(() => setLoadingR(false))
  }, [node.id])

  const nodeColor = node.type === 'PERSON' ? '#7F77DD' : '#1D9E75'

  return (
    <Box
      sx={{
        width: 340,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: nodeColor, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', lineHeight: 1.3 }}>
              {node.name}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
        <Stack direction="row" gap={0.5} mt={0.75} flexWrap="wrap">
          <Chip label={node.type} size="small" sx={{ fontSize: '0.65rem', height: 18, bgcolor: `${nodeColor}22`, color: nodeColor }} />
          {node.role_type && <Chip label={node.role_type} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />}
          {node.org_type  && <Chip label={node.org_type}  size="small" sx={{ fontSize: '0.65rem', height: 18 }} />}
          <Chip label={`${node.val} relationships`} size="small" sx={{ fontSize: '0.65rem', height: 18 }} />

          {/* PERSON / ORG node — single HubSpot chip linking directly to that contact */}
          {(node as any).hubspot_contact_id && (
            <Chip
              label="HubSpot"
              size="small"
              component="a"
              href={`https://app.hubspot.com/contacts/2951523/record/0-1/${(node as any).hubspot_contact_id}`}
              target="_blank"
              clickable
              sx={HS_CHIP_SX}
            />
          )}

          {/* DEAL node — one chip per connected person that has a HubSpot record.
              Shows first name only (compact). Hover for full name via title attr.
              Up to 3 chips then an overflow "+N in HubSpot" chip. */}
          {isDeal && hsContacts.slice(0, 3).map(c => (
            <Chip
              key={c.hubspot_contact_id}
              label={c.name.split(' ')[0]}
              title={c.name}
              size="small"
              component="a"
              href={`https://app.hubspot.com/contacts/2951523/record/0-1/${c.hubspot_contact_id}`}
              target="_blank"
              clickable
              sx={HS_CHIP_SX}
            />
          ))}
          {isDeal && hsContacts.length > 3 && (
            <Chip
              label={`+${hsContacts.length - 3} in HubSpot`}
              size="small"
              sx={{ ...HS_CHIP_SX, bgcolor: 'rgba(255,122,0,0.08)', border: '1px solid rgba(255,122,0,0.2)' }}
            />
          )}
        </Stack>
        {node.first_seen && (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            First seen: {dayjs(node.first_seen).format('MMM D, YYYY')}
          </Typography>
        )}

        {/* Tab strip — only shown for documents and deals */}
        {(isExtractableDoc || isDeal) && (
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v as number)}
            sx={{
              mt: 1,
              minHeight: 28,
              '& .MuiTab-root': { minHeight: 28, fontSize: '0.65rem', textTransform: 'none', py: 0.25, px: 1 },
              '& .MuiTabs-indicator': { height: 2 },
            }}
          >
            <Tab label="Activity" />
            {isExtractableDoc && <Tab label="Doc Intelligence" />}
            {isDeal && <Tab label="Deal Model" />}
          </Tabs>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Deal Model tab panel */}
        {isDeal && activeTab === 1 && (
          <DealDetailPanel nodeId={node.id} />
        )}
        {/* Doc Structure tab panel */}
        {isExtractableDoc && activeTab === 1 && (
          <DocStructureTab documentId={node.id} />
        )}
        {/* Activity panel — shown when not on a secondary tab */}
        {((!isExtractableDoc && !isDeal) || activeTab === 0) && (<>

        {/* Relationships */}
        <Box sx={{ px: 2, pt: 1.75, pb: 1 }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 500 }}>
            Relationships
          </Typography>
          {loadingRels ? (
            <Box sx={{ py: 1 }}><CircularProgress size={16} /></Box>
          ) : relationships.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>None found</Typography>
          ) : (
            <Stack gap={0.5} mt={0.75}>
              {relationships.map((r, i) => (
                <Box
                  key={i}
                  onClick={() => onNavigate({ id: r.object_id, name: r.object_name, type: r.object_type as any, val: 1, role_type: null, org_type: null, first_seen: null })}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75,
                    p: 0.75, borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Chip
                    label={r.predicate.replace('_', ' ')}
                    size="small"
                    sx={{
                      fontSize: '0.6rem', height: 16, flexShrink: 0,
                      bgcolor: `${PREDICATE_COLORS[r.predicate] ?? '#888'}22`,
                      color: PREDICATE_COLORS[r.predicate] ?? '#888',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.primary', fontSize: '0.75rem' }}>
                    {r.object_name}
                  </Typography>
                  <Chip
                    label={r.object_type}
                    size="small"
                    sx={{ fontSize: '0.58rem', height: 14, ml: 'auto', opacity: 0.6 }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Divider />

        {/* Emails */}
        <Box sx={{ px: 2, pt: 1.75 }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 500 }}>
            Email activity ({emails.length})
          </Typography>
          {loadingEmails ? (
            <Box sx={{ py: 1 }}><CircularProgress size={16} /></Box>
          ) : emails.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>No emails found</Typography>
          ) : (
            <Stack gap={0} mt={0.75}>
              {emails.map(e => {
                const intentColors: Record<string, string> = {
                  LEGAL: '#993556', DUE_DILIGENCE: '#BA7517',
                  CLOSING: '#1D9E75', FINANCING: '#185FA5',
                }
                return (
                  <Box
                    key={e.email_id}
                    onClick={() => handleEmailClick(e.email_id)}
                    sx={{
                      py: 1, borderBottom: '1px solid', borderColor: 'divider',
                      cursor: 'pointer',
                      borderRadius: 1,
                      px: 0.5,
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      bgcolor: selectedEmail?.email_id === e.email_id ? 'rgba(127,119,221,0.06)' : 'transparent',
                    }}
                  >
                    {e.sent_at && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.2 }}>
                        {dayjs(e.sent_at).format('MMM D, YYYY')}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.35, display: 'block', mb: 0.4 }}>
                      {e.subject.length > 60 ? e.subject.slice(0, 58) + '…' : e.subject}
                    </Typography>
                    {e.intent && e.intent !== 'UNKNOWN' && (
                      <Chip
                        label={e.intent.replace('_', ' ')}
                        size="small"
                        sx={{
                          fontSize: '0.6rem', height: 16,
                          bgcolor: `${intentColors[e.intent] ?? '#888'}22`,
                          color: intentColors[e.intent] ?? '#888',
                        }}
                      />
                    )}

                    {/* Inline email detail when selected */}
                    {selectedEmail?.email_id === e.email_id && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                        {loadingEmail ? (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Loading…</Typography>
                        ) : (
                          <>
                            {emailSummary && (
                              <Box sx={{ mb: 1, p: 1, bgcolor: 'rgba(127,119,221,0.06)', borderLeft: '2px solid rgba(127,119,221,0.5)', borderRadius: '0 4px 4px 0' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(232,230,224,0.85)', lineHeight: 1.6, display: 'block' }}>
                                  {emailSummary}
                                </Typography>
                              </Box>
                            )}
                            {emailActions.length > 0 && (
                              <Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.62rem' }}>
                                  Actions ({emailActions.length})
                                </Typography>
                                {emailActions.slice(0, 3).map((a, i) => (
                                  <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.4 }}>
                                    <Typography variant="caption" sx={{ color: 'secondary.main', flexShrink: 0, fontWeight: 600 }}>{i + 1}.</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>{a}</Typography>
                                  </Box>
                                ))}
                                {emailActions.length > 3 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>+{emailActions.length - 3} more</Typography>
                                )}
                              </Box>
                            )}
                          </>
                        )}
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Stack>
          )}
        </Box>
        <Divider />

        {/* Meeting activity */}
        <Box sx={{ px: 2, pt: 1.75, pb: 2 }}>
          <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 500 }}>
            Meeting activity ({meetings.length})
          </Typography>
          {loadingMeetings ? (
            <Box sx={{ py: 1 }}><CircularProgress size={16} /></Box>
          ) : meetings.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>No meetings found</Typography>
          ) : (
            <Stack gap={0} mt={0.75}>
              {meetings.map((m: any) => {
                const isSelected = selectedMeeting?.MEETING_ID === m.MEETING_ID
                return (
                  <Box
                    key={m.MEETING_ID}
                    onClick={() => setSelectedMeeting(isSelected ? null : m)}
                    sx={{
                      py: 1, borderBottom: '1px solid', borderColor: 'divider',
                      cursor: 'pointer', px: 0.5, borderRadius: 1,
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      bgcolor: isSelected ? 'rgba(43,143,212,0.06)' : 'transparent',
                    }}
                  >
                    {m.STARTED_AT && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.2 }}>
                        {new Date(m.STARTED_AT).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.35, display: 'block', mb: 0.4 }}>
                      {(m.MEETING_TITLE || '').length > 55 ? (m.MEETING_TITLE || '').slice(0, 53) + '…' : m.MEETING_TITLE}
                    </Typography>
                    <Chip
                      label={m.PLATFORM || 'meeting'}
                      size="small"
                      sx={{
                        fontSize: '0.6rem', height: 16,
                        bgcolor: 'rgba(43,143,212,0.12)', color: '#85B7EB',
                      }}
                    />

                    {/* Expanded meeting detail */}
                    {isSelected && m.SUMMARY && (
                      <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(43,143,212,0.06)', borderLeft: '2px solid rgba(43,143,212,0.4)', borderRadius: '0 4px 4px 0' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(133,183,235,0.8)', display: 'block', mb: 0.4, fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Summary
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(232,230,224,0.85)', lineHeight: 1.6, display: 'block' }}>
                          {m.SUMMARY}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Stack>
          )}
        </Box>
      </>)}
      </Box>
    </Box>
  )
}
