// NotificationBell.tsx
// Bell icon with unread badge + dropdown showing KG contribution results.
// Drop into GraphSidebar.tsx alongside the existing controls.
//
// Usage:
//   <NotificationBell alias={sessionAlias} />
//
// sessionAlias: pass from app state — the user's name set via kg_whoami.
// If no alias yet, show bell anyway but fetch all notifications.

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Badge, IconButton, Popover, Box, Typography,
  Divider, Chip, Stack, Tooltip, Button, CircularProgress,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnchorNode {
  type:    string
  name:    string
  node_id: string
  url:     string
}

interface NotificationPayload {
  anchored_to:  AnchorNode[]
  created:      { type: string; desc: string }[]
  warnings:     string[]
  document_id?: string
  doc_url?:     string
  error?:       string
}

interface Notification {
  notification_id: string
  job_id:          string
  session_alias:   string
  status:          'SUCCESS' | 'FAILED'
  summary:         string
  payload:         NotificationPayload
  read_at:         string
  created_at:      string
  unread:          boolean
}

interface Props {
  alias?:         string   // session alias — used to filter notifications
  onNodeFocus?:   (nodeId: string) => void  // called when user clicks a node link
  pollIntervalMs?: number  // default 30000 (30s)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationBell({
  alias = '',
  onNodeFocus,
  pollIntervalMs = 30_000,
}: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loading,       setLoading]       = useState(false)
  const [anchorEl,      setAnchorEl]      = useState<HTMLButtonElement | null>(null)
  const open = Boolean(anchorEl)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (alias) params.set('alias', alias)
      const res  = await fetch(`/api/notifications?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
    } catch {
      // silent — bell is non-critical
    }
  }, [alias])

  // ── Poll ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, pollIntervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications, pollIntervalMs])

  // ── Open popover ───────────────────────────────────────────────────────────
  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget)
    // Mark all visible as read when opening
    if (unreadCount > 0) {
      const unreadIds = notifications.filter(n => n.unread).map(n => n.notification_id)
      fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: unreadIds }),
      }).then(() => {
        setUnreadCount(0)
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
      })
    }
  }

  const handleClose = () => setAnchorEl(null)

  // ── Node click ─────────────────────────────────────────────────────────────
  const handleNodeClick = (nodeId: string, url: string) => {
    handleClose()
    if (onNodeFocus) {
      onNodeFocus(nodeId)
    } else {
      // Fallback: navigate to graph with focus param
      window.location.href = url
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Tooltip title="KG contributions">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{ color: unreadCount > 0 ? '#E8A838' : 'text.secondary' }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={9}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.6rem',
                height: 14,
                minWidth: 14,
                padding: '0 3px',
              },
            }}
          >
            <NotificationsIcon sx={{ fontSize: 18 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 520,
            bgcolor: '#1a1a1b',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider',
                   display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: 0.5 }}>
            KG CONTRIBUTIONS
          </Typography>
          {alias && (
            <Chip label={alias} size="small"
              sx={{ height: 16, fontSize: '0.58rem', bgcolor: 'rgba(232,168,56,0.12)', color: '#E8A838' }} />
          )}
        </Box>

        {/* Notification list */}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled">
                No contributions yet — use /save in Claude to add content to the KG.
              </Typography>
            </Box>
          ) : (
            notifications.map((n, i) => (
              <NotificationCard
                key={n.notification_id}
                notification={n}
                onNodeClick={handleNodeClick}
                showDivider={i < notifications.length - 1}
              />
            ))
          )}
        </Box>

        {/* Footer */}
        {notifications.length > 0 && (
          <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>
              {notifications.length} contribution{notifications.length !== 1 ? 's' : ''}
              {alias ? ` from ${alias}` : ''}
            </Typography>
          </Box>
        )}
      </Popover>
    </>
  )
}


// ── NotificationCard ──────────────────────────────────────────────────────────
function NotificationCard({
  notification: n,
  onNodeClick,
  showDivider,
}: {
  notification: Notification
  onNodeClick: (nodeId: string, url: string) => void
  showDivider: boolean
}) {
  const isSuccess = n.status === 'SUCCESS'
  const payload   = n.payload || {}
  const anchors   = payload.anchored_to || []
  const warnings  = payload.warnings || []
  const timeStr   = n.created_at ? new Date(n.created_at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  return (
    <>
      <Box sx={{
        px: 2, py: 1.25,
        bgcolor: n.unread ? 'rgba(232,168,56,0.04)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        transition: 'background 0.15s',
      }}>
        {/* Status + time */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            {isSuccess
              ? <CheckCircleOutlineIcon sx={{ fontSize: 13, color: '#1D9E75' }} />
              : <ErrorOutlineIcon      sx={{ fontSize: 13, color: 'error.main' }} />
            }
            {n.unread && (
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#E8A838' }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.58rem' }}>
            {timeStr}
          </Typography>
        </Stack>

        {/* Summary */}
        <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5, color: 'text.primary' }}>
          {n.summary}
        </Typography>

        {/* Anchor node links */}
        {anchors.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
            {anchors.map((a) => (
              <Chip
                key={a.node_id}
                label={a.name}
                size="small"
                onClick={() => onNodeClick(a.node_id, a.url)}
                icon={<OpenInNewIcon style={{ fontSize: 9 }} />}
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  cursor: 'pointer',
                  bgcolor: nodeTypeColor(a.type) + '1a',
                  color:   nodeTypeColor(a.type),
                  border: '1px solid ' + nodeTypeColor(a.type) + '44',
                  '&:hover': { bgcolor: nodeTypeColor(a.type) + '33' },
                  '& .MuiChip-icon': { color: nodeTypeColor(a.type) },
                }}
              />
            ))}
          </Stack>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Box mt={0.5}>
            {warnings.map((w, i) => (
              <Typography key={i} variant="caption"
                sx={{ fontSize: '0.6rem', color: '#E8A838', display: 'block' }}>
                ⚠ {w}
              </Typography>
            ))}
          </Box>
        )}

        {/* Error */}
        {!isSuccess && payload.error && (
          <Typography variant="caption" color="error" sx={{ fontSize: '0.62rem', display: 'block', mt: 0.25 }}>
            {payload.error}
          </Typography>
        )}
      </Box>

      {showDivider && <Divider sx={{ opacity: 0.4 }} />}
    </>
  )
}


// ── Helpers ───────────────────────────────────────────────────────────────────
function nodeTypeColor(type: string): string {
  const map: Record<string, string> = {
    PERSON:       '#7F77DD',
    ORGANIZATION: '#1D9E75',
    PROPERTY:     '#E8A838',
    DOCUMENT:     '#5DCAA5',
    DEAL:         '#D85A30',
    MEETING:      '#2B8FD4',
  }
  return map[type?.toUpperCase()] ?? '#888'
}
