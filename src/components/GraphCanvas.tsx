import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Box, Typography } from '@mui/material'
import type { GraphNode, GraphLink, GraphData, GraphFilters } from '../types'
import { getNodeColor, getLinkColor } from '../theme'
import { fetchGraph, fetchEntitySubgraph } from '../api'

// Zoom to fit a specific set of nodes (by id), with padding.
// Falls back to zoomToFit if the set is empty or positions aren't ready.
function zoomToNodes(fg: any, nodeIds: Set<string>, allNodes: any[], msTransition = 500, padding = 80) {
  if (!fg || nodeIds.size === 0) { fg?.zoomToFit(msTransition, padding); return }
  const targets = allNodes.filter(n => nodeIds.has(n.id) && n.x != null && n.y != null)
  if (targets.length === 0) { fg?.zoomToFit(msTransition, padding); return }
  const xs = targets.map(n => n.x as number)
  const ys = targets.map(n => n.y as number)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const spanX = (maxX - minX) || 1
  const spanY = (maxY - minY) || 1
  // Approximate canvas size; react-force-graph doesn't expose width/height on the ref easily
  const W = (fg.__internalRef?.current?.clientWidth  ?? window.innerWidth)  - padding * 2
  const H = (fg.__internalRef?.current?.clientHeight ?? window.innerHeight) - padding * 2
  const zoomLevel = Math.min(W / spanX, H / spanY, 8)
  fg.centerAt(cx, cy, msTransition)
  fg.zoom(zoomLevel, msTransition)
}

interface Props {
  filters:         GraphFilters
  onNodeSelect:    (node: GraphNode | null) => void
  focusedEntityId: string | null
  selectedNode:    GraphNode | null
  onGraphLoaded:   (totalNodes: number, totalLinks: number) => void
}

export default function GraphCanvas({
  filters, onNodeSelect, focusedEntityId, onGraphLoaded, selectedNode,
}: Props) {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [], total_nodes: 0, total_links: 0 })
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const fgRef                     = useRef<any>(null)
  const containerRef              = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width:  entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Subgraph effect: fires when focusedEntityId changes ─────────────────────
  // Completely separate from the full-graph effect so they can't race.
  useEffect(() => {
    if (!focusedEntityId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setGraphData({ nodes: [], links: [], total_nodes: 0, total_links: 0 })

    fetchEntitySubgraph(focusedEntityId, 2)
      .then(data => {
        if (cancelled) return
        const connCount: Record<string, number> = {}
        for (const l of data.links) {
          const src = typeof l.source === 'object' ? (l.source as any).id : l.source as string
          const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target as string
          connCount[src] = (connCount[src] ?? 0) + 1
          connCount[tgt] = (connCount[tgt] ?? 0) + 1
        }
        const totalLinks = data.links.length
        const finalNodes = data.nodes.map(n => ({
          ...n,
          val: n.id === focusedEntityId
            ? Math.max(1, totalLinks)
            : Math.max(1, connCount[n.id] ?? 1),
        }))
        const filtered = { ...data, nodes: finalNodes, total_nodes: finalNodes.length }
        setGraphData(filtered)
        onGraphLoaded(filtered.total_nodes, filtered.total_links)
        // Auto-select fires via onEngineStop after sim settles
        const focusNode = finalNodes.find(n => n.id === focusedEntityId)
        if (focusNode) setTimeout(() => onNodeSelect(focusNode as any), 150)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [focusedEntityId])

  // ── Full graph effect: only fires when there is no focused entity ──────────
  useEffect(() => {
    if (focusedEntityId) return   // subgraph effect owns this case
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchGraph({
      from_date:   filters.from_date ?? undefined,
      to_date:     filters.to_date ?? undefined,
      entity_type: filters.entity_type ?? undefined,
      limit:       filters.limit,
    })
      .then(data => {
        if (cancelled) return
        const activeSources = filters.source_types ?? ['EMAIL', 'DOCUMENT', 'MEETING']
        const sourceFilteredLinks = activeSources.length === 3
          ? data.links
          : data.links.filter(l => activeSources.includes((l as any).source_type?.toUpperCase() ?? 'EMAIL'))

        const connCount: Record<string, number> = {}
        for (const l of sourceFilteredLinks) {
          const src = typeof l.source === 'object' ? (l.source as any).id : l.source as string
          const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target as string
          connCount[src] = (connCount[src] ?? 0) + 1
          connCount[tgt] = (connCount[tgt] ?? 0) + 1
        }

        const densityPct = (filters.min_connections - 1) / 19
        const counts = Object.values(connCount)
        const avgConn = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 1
        const minConnThreshold = densityPct <= 0 ? 0 : Math.max(1, avgConn * densityPct)

        const filteredNodes = data.nodes.filter(n => (connCount[n.id] ?? 0) >= minConnThreshold)
        const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
        const filteredLinks = sourceFilteredLinks.filter(l => {
          const src = typeof l.source === 'object' ? (l.source as any).id : l.source as string
          const tgt = typeof l.target === 'object' ? (l.target as any).id : l.target as string
          return filteredNodeIds.has(src) && filteredNodeIds.has(tgt)
        })

        const finalNodes = filteredNodes.map(n => ({
          ...n,
          val: Math.max(1, connCount[n.id] ?? 1),
        }))

        const filtered = {
          ...data,
          nodes: finalNodes,
          links: filteredLinks,
          total_nodes: finalNodes.length,
          total_links: filteredLinks.length,
        }
        setGraphData(filtered)
        onGraphLoaded(filtered.total_nodes, filtered.total_links)
        setTimeout(() => fgRef.current?.zoomToFit(400, 60), 300)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [focusedEntityId, filters.from_date, filters.to_date, filters.entity_type, filters.limit, filters.min_connections, JSON.stringify(filters.source_types)])

  // When subgraph data loads, crank up repulsion so nodes spread apart naturally
  useEffect(() => {
    if (!fgRef.current) return
    if (focusedEntityId && graphData.nodes.length > 0) {
      // Strong repulsion for small subgraph — nodes spread far apart
      fgRef.current.d3Force('charge')?.strength(-800)
      fgRef.current.d3Force('link')?.distance(120)
      fgRef.current.d3ReheatSimulation()
    } else if (!focusedEntityId) {
      // Reset to defaults for full graph
      fgRef.current.d3Force('charge')?.strength(-30)
      fgRef.current.d3Force('link')?.distance(30)
    }
  }, [focusedEntityId, graphData.nodes.length])

  // Pin node on drag end so it stays where placed
  const handleNodeDragEnd = useCallback((node: any) => {
    node.fx = node.x
    node.fy = node.y
  }, [])

  // Single click — select node
  const handleNodeClick = useCallback((node: any) => {
    onNodeSelect(node as GraphNode)
    fgRef.current?.centerAt(node.x, node.y, 400)
  }, [onNodeSelect])

  // Double click — zoom into node
  const handleNodeDblClick = useCallback((node: any) => {
    fgRef.current?.centerAt(node.x, node.y, 400)
    fgRef.current?.zoom(6, 400)
  }, [])

  const handleBackgroundClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  // Double click on canvas background — zoom out
  const handleBackgroundDblClick = useCallback(() => {
    fgRef.current?.zoomToFit(400, 60)
  }, [])

  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r        = Math.sqrt(Math.min(node.val, 30)) * 2.2 + 3
    const color    = getNodeColor(node.type)
    const label    = node.name
    const isSelected = selectedNode?.id === node.id

    // Dimming when another node is selected
    const alpha = selectedNode
      ? (isSelected || node._isConnected ? 1.0 : 0.15)
      : 1.0
    ctx.globalAlpha = alpha

    // Outer glow — brighter for selected
    ctx.beginPath()
    ctx.arc(node.x, node.y, r + (isSelected ? 5 : 2.5), 0, 2 * Math.PI)
    ctx.fillStyle = isSelected ? `${color}44` : `${color}1a`
    ctx.fill()

    // Main circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    // Border
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.strokeStyle = isSelected ? '#FFFFFF' : `${color}66`
    ctx.lineWidth   = isSelected ? 2 : 0.5
    ctx.stroke()

    // Label
    const showLabel = globalScale >= 1.0 || node.val > 6 || isSelected
    if (showLabel) {
      const fontSize = Math.min(11, Math.max(7, 10 / globalScale))
      ctx.font          = `${fontSize}px Inter, sans-serif`
      ctx.textAlign     = 'center'
      ctx.textBaseline  = 'top'
      const displayName = label.length > 24 ? label.slice(0, 22) + '…' : label
      const textY       = node.y + r + 2

      ctx.fillStyle = 'rgba(10,10,11,0.7)'
      ctx.fillText(displayName, node.x + 0.5, textY + 0.5)
      ctx.fillStyle = isSelected ? '#FFFFFF' : 'rgba(232,230,224,0.92)'
      ctx.fillText(displayName, node.x, textY)
    }

    ctx.globalAlpha = 1.0
  }, [selectedNode])

  const drawLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source
    const tgt = link.target
    if (typeof src !== 'object' || typeof tgt !== 'object') return

    const isHighlighted = selectedNode &&
      (src.id === selectedNode.id || tgt.id === selectedNode.id)

    const color     = isHighlighted ? '#2B9FE8' : getLinkColor(link.predicate)
    const lineWidth = isHighlighted ? 2.0 : 0.5
    const alpha     = selectedNode ? (isHighlighted ? 1.0 : 0.04) : 0.35

    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.lineTo(tgt.x, tgt.y)
    ctx.strokeStyle = color
    ctx.lineWidth   = lineWidth
    ctx.stroke()

    // Predicate label at midpoint — only when zoomed in and highlighted
    if (globalScale >= 2.5 && isHighlighted) {
      ctx.globalAlpha = 0.9
      const mx       = (src.x + tgt.x) / 2
      const my       = (src.y + tgt.y) / 2
      const fontSize = Math.min(8, 7 / globalScale)
      ctx.font          = `${fontSize}px Inter, sans-serif`
      ctx.textAlign     = 'center'
      ctx.textBaseline  = 'middle'
      ctx.fillStyle     = '#2B9FE8'
      ctx.fillText(link.predicate.replace(/_/g, ' ').toLowerCase(), mx, my)
    }

    ctx.globalAlpha = 1.0
  }, [selectedNode])

  // Mark connected nodes + apply radial ego layout on selection
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    if (!selectedNode) {
      // Deselect — unpin all nodes and reheat
      for (const n of (graphData.nodes as any[])) {
        n._isConnected = false
        n.fx = undefined
        n.fy = undefined
      }
      fg.d3ReheatSimulation()
      setTimeout(() => fg.zoomToFit(400, 60), 300)
      return
    }

    // Build connected set
    const connectedIds = new Set<string>()
    for (const l of graphData.links as any[]) {
      const s = typeof l.source === 'object' ? l.source.id : l.source
      const t = typeof l.target === 'object' ? l.target.id : l.target
      if (s === selectedNode.id) connectedIds.add(t)
      if (t === selectedNode.id) connectedIds.add(s)
    }
    for (const n of graphData.nodes as any[]) {
      n._isConnected = connectedIds.has(n.id)
    }

    // Radial ego layout
    // Selected node anchors at left-center, connected nodes fan right
    const W = dimensions.width
    const H = dimensions.height
    const cx = W * 0.22
    const cy = H * 0.5
    const radius = Math.min(W, H) * 0.30

    const selNode = (graphData.nodes as any[]).find(n => n.id === selectedNode.id)
    if (selNode) { selNode.fx = cx; selNode.fy = cy }

    const connected = (graphData.nodes as any[]).filter(n => connectedIds.has(n.id))
    const total = connected.length
    connected.forEach((n, i) => {
      // Fan from -90deg to +90deg (right semicircle)
      const angle = -Math.PI / 2 + (Math.PI * i) / Math.max(total - 1, 1)
      n.fx = cx + radius * Math.cos(angle) * 2.0
      n.fy = cy + radius * Math.sin(angle)
    })

    // Release unconnected so they drift to periphery
    for (const n of graphData.nodes as any[]) {
      if (n.id !== selectedNode.id && !connectedIds.has(n.id)) {
        n.fx = undefined
        n.fy = undefined
      }
    }

    fg.d3ReheatSimulation()

    // Zoom to fit only the ego subgraph — selected node + its connected ring.
    // Wait for the simulation to settle the pinned positions before measuring.
    const egoIds = new Set([selectedNode.id, ...connectedIds])
    setTimeout(() => zoomToNodes(fg, egoIds, graphData.nodes as any[], 500, 80), 600)
  }, [selectedNode, graphData, dimensions])

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        position: 'relative',
        bgcolor: '#0a0a0b',
        overflow: 'hidden',
      }}
    >
      {loading && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Loading graph…</Typography>
        </Box>
      )}

      {error && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'error.main' }}>Failed to load graph</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{error}</Typography>
        </Box>
      )}

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0a0b"
        nodeCanvasObject={drawNode}
        nodeCanvasObjectMode={() => 'replace'}
        linkCanvasObject={drawLink}
        linkCanvasObjectMode={() => 'replace'}
        onNodeClick={handleNodeClick}
        onNodeDblClick={handleNodeDblClick}
        onNodeDragEnd={handleNodeDragEnd}
        onBackgroundClick={handleBackgroundClick}
        onBackgroundRightClick={handleBackgroundDblClick}
        nodeLabel={(node: any) => `${node.name}\n${node.type}${node.role_type ? ' · ' + node.role_type : ''}`}
        linkLabel={(link: any) => link.predicate}
        cooldownTicks={focusedEntityId ? 80 : 120}
        d3AlphaDecay={focusedEntityId ? 0.03 : 0.015}
        d3VelocityDecay={focusedEntityId ? 0.4 : 0.25}
        d3Force={'charge' as any}
        onEngineStop={() => {
          if (focusedEntityId) {
            fgRef.current?.zoomToFit(400, 60)
          }
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={(link: any) => getLinkColor(link.predicate)}
        enableNodeDrag={false}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      {!loading && graphData.nodes.length > 0 && (
        <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          <Typography variant="caption" sx={{ color: 'rgba(136,135,128,0.6)' }}>
            click to highlight · double-click to zoom · right-click canvas to fit
          </Typography>
        </Box>
      )}
    </Box>
  )
}
