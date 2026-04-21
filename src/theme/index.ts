import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: '#7F77DD' },
    secondary: { main: '#1D9E75' },
    background: {
      default: '#0e0e0f',
      paper:   '#161618',
    },
    text: {
      primary:   '#e8e6e0',
      secondary: '#9c9a92',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    fontSize:   13,
    h6:   { fontWeight: 500, fontSize: '0.95rem' },
    body2:{ fontSize: '0.8rem' },
    caption: { fontSize: '0.72rem', color: '#888780' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: '0.7rem' },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(255,255,255,0.07)' },
      },
    },
  },
})

// Node colours by entity type — matches Epstein explorer palette
export const NODE_COLORS: Record<string, string> = {
  PERSON:       '#7F77DD',  // purple
  ORGANIZATION: '#1D9E75',  // teal
  EMAIL:        '#BA7517',  // amber
  DEAL:         '#D85A30',  // coral
  MEETING:      '#2B8FD4',  // blue
  PROPERTY:     '#E8A838',  // gold — properties are assets
}

// Link colours by predicate
export const LINK_COLORS: Record<string, string> = {
  EMPLOYED_BY:  'rgba(127,119,221,0.5)',
  SENT_TO:      'rgba(29,158,117,0.5)',
  GOVERNED_BY:  'rgba(186,117,23,0.5)',
  FINANCED_BY:  'rgba(216,90,48,0.5)',
  OWNS:         'rgba(212,83,126,0.5)',
  MANAGED_BY:   'rgba(29,158,117,0.4)',
  REFERENCES:   'rgba(136,135,128,0.4)',
  MENTIONS:     'rgba(136,135,128,0.35)',
  ATTENDED:     'rgba(43,143,212,0.5)',
  ORGANIZED:    'rgba(43,143,212,0.7)',
  ASSIGNED_TO:  'rgba(43,143,212,0.4)',
}

export const getLinkColor = (predicate: string): string =>
  LINK_COLORS[predicate] ?? 'rgba(136,135,128,0.3)'

export const getNodeColor = (type: string): string =>
  NODE_COLORS[type] ?? '#888780'
