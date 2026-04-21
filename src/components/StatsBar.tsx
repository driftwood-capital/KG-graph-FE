import { useEffect, useState } from 'react'
import { Box, Typography, Chip, Skeleton, Tooltip } from '@mui/material'
import { CircleIcon } from '../icons'
import { fetchStats } from '../api'
import type { Stats } from '../types'

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetchStats().then(setStats).catch(console.error)
  }, [])

  const items = stats
    ? [
        { label: 'Emails',        value: stats.emails,        color: '#BA7517' },
        { label: 'Persons',       value: stats.persons,       color: '#7F77DD' },
        { label: 'Organizations', value: stats.organizations, color: '#1D9E75' },
        { label: 'Relationships', value: stats.relationships, color: '#D85A30' },
        { label: 'Obligations',   value: stats.obligations,   color: '#993556' },
        { label: 'Vectors',       value: stats.vectors,       color: '#888780' },
      ]
    : []

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexWrap: 'wrap',
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, color: 'text.secondary', mr: 1, letterSpacing: 1, textTransform: 'uppercase' }}
      >
        Driftwood KG
      </Typography>

      {!stats
        ? [1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} variant="rounded" width={80} height={22} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
          ))
        : items.map(({ label, value, color }) => (
            <Tooltip key={label} title={label}>
              <Chip
                icon={<CircleIcon sx={{ fontSize: '8px !important', color: `${color} !important` }} />}
                label={`${value.toLocaleString()} ${label}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: 'text.secondary',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
                }}
              />
            </Tooltip>
          ))}

      {stats?.last_ingested && (
        <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
          Last ingested: {new Date(stats.last_ingested).toLocaleDateString()}
        </Typography>
      )}
    </Box>
  )
}
