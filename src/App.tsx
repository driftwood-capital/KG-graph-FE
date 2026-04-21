import { useState, useCallback, useEffect } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import StatsBar          from './components/StatsBar'
import GraphSidebar      from './components/GraphSidebar'
import GraphCanvas       from './components/GraphCanvas'
import TimelinePanel     from './components/TimelinePanel'
import MeetingsPanel     from './components/MeetingsPanel'
import EntityDetailPanel from './components/EntityDetailPanel'
import ObligationsView   from './components/ObligationsView'
import SearchPanel       from './components/SearchPanel'
import IngestPanel       from './components/IngestPanel'
import DocumentUpload    from './components/DocumentUpload'
import DealsPanel        from './components/DealsPanel'
import DealsTab          from './components/DealsTab'
import type { GraphNode, GraphFilters } from './types'

const DEFAULT_FILTERS: GraphFilters = {
  from_date: null, to_date: null, entity_type: null,
  limit: 5000, min_connections: 1, max_hops: 0,
  source_types: ['EMAIL', 'DOCUMENT', 'MEETING'],
  doc_types:    null,
}

type View       = 'graph' | 'deals' | 'obligations' | 'search' | 'ingest' | 'documents'
type RightPanel = 'timeline' | 'meetings'

export default function App() {
  const [view,            setView]            = useState<View>('graph')
  const [rightPanel,      setRightPanel]      = useState<RightPanel>('timeline')
  const [selectedNode,    setSelectedNode]    = useState<GraphNode | null>(null)
  const [entityDetail,    setEntityDetail]    = useState<GraphNode | null>(null)
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null)
  const [filters,         setFilters]         = useState<GraphFilters>(DEFAULT_FILTERS)
  const [totalNodes,      setTotalNodes]      = useState(0)
  const [totalLinks,      setTotalLinks]      = useState(0)
  const [loading,         setLoading]         = useState(true)

  // ── Deep link: read ?focus=<node_id> on mount ──────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const focusId = params.get('focus')
    if (focusId) {
      setFocusedEntityId(focusId)
      setView('graph')
    }
  }, [])

  // ── Sync ?focus param to URL whenever focusedEntityId changes ─────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (focusedEntityId) {
      params.set('focus', focusedEntityId)
    } else {
      params.delete('focus')
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  }, [focusedEntityId])

  const handleNodeSelect = useCallback((node: GraphNode | null) => {
    setSelectedNode(node)
    if (node) setEntityDetail(node)
  }, [])

  const handleFocusNode = useCallback((nodeId: string) => {
    setFocusedEntityId(nodeId)
  }, [])

  const handleResetGraph = useCallback(() => {
    setFocusedEntityId(null)
    setSelectedNode(null)
    setEntityDetail(null)
    setFilters(DEFAULT_FILTERS)
  }, [])

  const handleFiltersChange = useCallback((partial: Partial<GraphFilters>) => {
    setFilters(prev => ({ ...prev, ...partial }))
  }, [])

  const handleGraphLoaded = useCallback((nodes: number, links: number) => {
    setTotalNodes(nodes)
    setTotalLinks(links)
    setLoading(false)
  }, [])

  const handleEntityNavigate = useCallback((node: GraphNode) => {
    setEntityDetail(node)
    setSelectedNode(node)
    setFocusedEntityId(node.id)
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>

      {/* Top bar */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
        <StatsBar />
        <Tabs
          value={view}
          onChange={(_, v) => setView(v)}
          sx={{
            ml: 'auto', minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, fontSize: '0.75rem', textTransform: 'none', px: 2, py: 0.5 },
            '& .MuiTabs-indicator': { height: 2 },
          }}
        >
          <Tab value="graph"       label="Graph" />
          <Tab value="deals"       label="Deals" />
          <Tab value="obligations" label="Obligations" />
          <Tab value="search"      label="Search" />
          <Tab value="documents"   label="Documents" />
          <Tab value="ingest"      label="Ingest" />
        </Tabs>
      </Box>

      {/* Main content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {view === 'graph' && (
          <>
            <GraphSidebar
              selectedNode    = {selectedNode}
              onClearSelected = {() => { setSelectedNode(null); setEntityDetail(null) }}
              onFocusNode     = {handleFocusNode}
              onNodeSelect    = {handleNodeSelect}
              onResetGraph    = {handleResetGraph}
              filters         = {filters}
              onFiltersChange = {handleFiltersChange}
              totalNodes      = {totalNodes}
              totalLinks      = {totalLinks}
              loading         = {loading}
            />

            <GraphCanvas
              filters         = {filters}
              onNodeSelect    = {handleNodeSelect}
              focusedEntityId = {focusedEntityId}
              selectedNode    = {selectedNode}
              onGraphLoaded   = {handleGraphLoaded}
            />

            {/* Right panel */}
            {entityDetail ? (
              <EntityDetailPanel
                node         = {entityDetail}
                onClose      = {() => { setEntityDetail(null); setSelectedNode(null) }}
                onNavigate   = {handleEntityNavigate}
                onEmailClick = {(id) => console.log('email', id)}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid', borderColor: 'divider', width: 320, flexShrink: 0 }}>
                {/* Timeline / Meetings toggle */}
                <Box sx={{ display: 'flex', borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                  {(['timeline', 'meetings'] as const).map(panel => (
                    <Box
                      key={panel}
                      onClick={() => setRightPanel(panel)}
                      sx={{
                        px: 2, py: 1, cursor: 'pointer',
                        fontSize: '0.72rem',
                        textTransform: 'capitalize',
                        color: rightPanel === panel ? 'text.primary' : 'text.secondary',
                        borderBottom: '2px solid',
                        borderBottomColor: rightPanel === panel ? 'primary.main' : 'transparent',
                        fontWeight: rightPanel === panel ? 500 : 400,
                        bgcolor: 'background.paper',
                        '&:hover': { color: 'text.primary' },
                        transition: 'all 0.15s',
                      }}
                    >
                      {panel}
                    </Box>
                  ))}
                </Box>

                {rightPanel === 'timeline' ? (
                  <TimelinePanel
                    focusedNode  = {selectedNode}
                    onEmailClick = {(id) => console.log('email', id)}
                  />
                ) : (
                  <MeetingsPanel focusedNode={selectedNode} />
                )}
              </Box>
            )}
          </>
        )}

        {view === 'deals' && (
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <DealsTab />
          </Box>
        )}

        {view === 'obligations' && (
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <ObligationsView />
          </Box>
        )}

        {view === 'search' && (
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <SearchPanel />
          </Box>
        )}

        {view === 'documents' && (
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <DocumentUpload />
          </Box>
        )}

        {view === 'ingest' && (
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <IngestPanel />
          </Box>
        )}

      </Box>
    </Box>
  )
}
