'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, RadialBarChart, RadialBar,
} from 'recharts'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Types
interface SheetRow {
  CLIENT: string
  MAPPING: string
  RC: string
  COUNTRY: string
  STATUS: string
  'UPDATE NOTION': string
  'Business Case': string
  CONTRAT: string
  'REPORTINGS 2025': string
  'COPROD/COPIL': string
  COSTRAT: string
  ROA: string
  [key: string]: string
}

interface APIResponse {
  data: SheetRow[]
  headers: string[]
  lastUpdated: string
  totalRows: number
  error?: string
}

// Color palette
const COLORS = {
  accent: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
}

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#06b6d4', '#ec4899', '#f97316', '#14b8a6']

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000

export default function DashboardPage() {
  const [data, setData] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')
  const [rcFilter, setRcFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roaFilter, setRoaFilter] = useState('all')

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/sheets', { cache: 'no-store' })
      const json: APIResponse = await res.json()
      if (json.error) {
        setError(json.error)
      } else {
        setData(json.data || [])
        setLastUpdated(json.lastUpdated)
        setError(null)
      }
    } catch (err) {
      setError('Failed to connect to the server')
      console.error(err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  // Derived: unique filter values
  const countries = useMemo(() => [...new Set(data.map(r => r.COUNTRY).filter(Boolean))].sort(), [data])
  const rcs = useMemo(() => [...new Set(data.map(r => r.RC).filter(Boolean))].sort(), [data])
  const statuses = useMemo(() => [...new Set(data.map(r => r.STATUS).filter(Boolean))].sort(), [data])
  const roas = useMemo(() => [...new Set(data.map(r => r.ROA).filter(Boolean))].sort(), [data])

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchCountry = countryFilter === 'all' || row.COUNTRY === countryFilter
      const matchRC = rcFilter === 'all' || row.RC === rcFilter
      const matchStatus = statusFilter === 'all' || row.STATUS === statusFilter
      const matchROA = roaFilter === 'all' || row.ROA === roaFilter
      const matchSearch = searchQuery === '' ||
        Object.values(row).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchCountry && matchRC && matchStatus && matchROA && matchSearch
    })
  }, [data, countryFilter, rcFilter, statusFilter, roaFilter, searchQuery])

  // KPI calculations
  const kpis = useMemo(() => {
    const total = filteredData.length
    const zero = {
      total: 0,
      bcComplete: 0, bcPct: 0,
      notionComplete: 0, notionPct: 0,
      contratComplete: 0, contratPct: 0,
      reportingComplete: 0, reportingPct: 0,
      coprodComplete: 0, coprodPct: 0,
      costratComplete: 0, costratPct: 0,
      archivagePct: 0,
    }
    if (total === 0) return zero

    const isComplete = (val: string) => val?.trim().toLowerCase() === 'complet'

    const bcComplete = filteredData.filter(r => isComplete(r['Business Case'])).length
    const notionComplete = filteredData.filter(r => isComplete(r['UPDATE NOTION'])).length
    const contratComplete = filteredData.filter(r => isComplete(r.CONTRAT)).length
    const reportingComplete = filteredData.filter(r => isComplete(r['REPORTINGS 2025'])).length
    const coprodComplete = filteredData.filter(r => isComplete(r['COPROD/COPIL'])).length
    const costratComplete = filteredData.filter(r => isComplete(r.COSTRAT)).length

    const archivageComplete = filteredData.filter(r =>
      isComplete(r.CONTRAT) && isComplete(r['REPORTINGS 2025']) &&
      isComplete(r['COPROD/COPIL']) && isComplete(r.COSTRAT)
    ).length

    return {
      total,
      bcComplete, bcPct: Math.round((bcComplete / total) * 100),
      notionComplete, notionPct: Math.round((notionComplete / total) * 100),
      contratComplete, contratPct: Math.round((contratComplete / total) * 100),
      reportingComplete, reportingPct: Math.round((reportingComplete / total) * 100),
      coprodComplete, coprodPct: Math.round((coprodComplete / total) * 100),
      costratComplete, costratPct: Math.round((costratComplete / total) * 100),
      archivagePct: Math.round((archivageComplete / total) * 100),
    }
  }, [filteredData])

  // Chart data: Status breakdown
  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredData.forEach(r => {
      const s = r.STATUS || 'Non défini'
      counts[s] = (counts[s] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredData])

  // Chart data: Country breakdown
  const countryChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredData.forEach(r => {
      const c = r.COUNTRY || 'N/A'
      counts[c] = (counts[c] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [filteredData])

  // Chart data: RC workload
  const rcChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredData.forEach(r => {
      const rc = r.RC || 'N/A'
      counts[rc] = (counts[rc] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12)
  }, [filteredData])

  // Gauge data for radial chart
  const gaugeData = useMemo(() => [
    { name: 'Business Case', value: kpis.bcPct, fill: COLORS.success },
    { name: 'Notion', value: kpis.notionPct, fill: COLORS.purple },
    { name: 'Archivage', value: kpis.archivagePct, fill: COLORS.accent },
    { name: 'Contrat', value: kpis.contratPct, fill: COLORS.info },
    { name: 'Reporting', value: kpis.reportingPct, fill: COLORS.cyan },
    { name: 'Costrat', value: kpis.costratPct, fill: COLORS.warning },
  ], [kpis])

  // Badge helper
  const getBadgeClass = (val: string) => {
    const v = (val || '').trim().toLowerCase()
    if (v === 'complet') return 'badge badge-success'
    if (v === 'en cours' || v === 'incomplet') return 'badge badge-warning'
    if (v === 'non créé' || v === '') return 'badge badge-neutral'
    if (v === 'actif' || v === 'active') return 'badge badge-info'
    if (v === 'inactif' || v === 'inactive' || v === 'perdu' || v === 'churné') return 'badge badge-danger'
    return 'badge badge-neutral'
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch (_e) { return iso }
  }

  // Custom tooltip
  const CustomTooltip = (props: any) => {
    const { active, payload, label } = props
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#1a2236',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: '#f1f5f9'
        }}>
          <p style={{ fontWeight: 600 }}>{label}</p>
          <p style={{ color: '#6366f1' }}>{payload[0].value} clients</p>
        </div>
      )
    }
    return null
  }

  // Loading state
  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p className="loading-text">Connexion à Google Sheets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header animate-in">
        <div className="header-left">
          <h1>BC Follow-Up Dashboard</h1>
          <p>Suivi opérationnel des Business Cases · Google Sheets Live</p>
        </div>
        <div className="header-right">
          <div className="live-indicator">
            <span className="live-dot" />
            Live
          </div>
          <button
            className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => fetchData(false)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Actualiser
          </button>
          {lastUpdated && (
            <span className="last-updated">
              Mis à jour : {formatDate(lastUpdated)}
            </span>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner animate-in">
          ⚠️ {error} — Les données affichées peuvent être obsolètes.
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid animate-in delay-1">
        <div className="kpi-card accent">
          <p className="kpi-label">Total Clients</p>
          <p className="kpi-value accent">{kpis.total}</p>
          <p className="kpi-sub">dans le périmètre filtré</p>
        </div>
        <div className="kpi-card success">
          <p className="kpi-label">Business Case</p>
          <p className="kpi-value success">{kpis.bcPct}%</p>
          <p className="kpi-sub">{kpis.bcComplete}/{kpis.total} complets</p>
        </div>
        <div className="kpi-card purple">
          <p className="kpi-label">Update Notion</p>
          <p className="kpi-value purple">{kpis.notionPct}%</p>
          <p className="kpi-sub">{kpis.notionComplete}/{kpis.total} complets</p>
        </div>
        <div className="kpi-card info">
          <p className="kpi-label">Archivage Instance</p>
          <p className="kpi-value info">{kpis.archivagePct}%</p>
          <p className="kpi-sub">Contrat+Report+Coprod+Costrat</p>
        </div>
        <div className="kpi-card cyan">
          <p className="kpi-label">Contrat</p>
          <p className="kpi-value cyan">{kpis.contratPct}%</p>
          <p className="kpi-sub">{kpis.contratComplete}/{kpis.total} complets</p>
        </div>
        <div className="kpi-card warning">
          <p className="kpi-label">Reportings 2025</p>
          <p className="kpi-value warning">{kpis.reportingPct}%</p>
          <p className="kpi-sub">{kpis.reportingComplete}/{kpis.total} complets</p>
        </div>
        <div className="kpi-card danger">
          <p className="kpi-label">Costrat</p>
          <p className="kpi-value danger">{kpis.costratPct}%</p>
          <p className="kpi-sub">{kpis.costratComplete}/{kpis.total} complets</p>
        </div>
      </div>

      {/* Charts Row 1: Gauges + Status Breakdown */}
      <h2 className="section-title animate-in delay-2">Indicateurs de Complétion</h2>
      <div className="charts-grid animate-in delay-2">
        {/* Radial gauge chart */}
        <div className="chart-card">
          <h3>Taux de complétion par catégorie</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="20%"
              outerRadius="90%"
              barSize={14}
              data={gaugeData}
              startAngle={180}
              endAngle={-180}
            >
              <RadialBar
                background={{ fill: '#1a2236' } as any}
                dataKey="value"
                cornerRadius={8}
              />
              <Legend
                iconSize={10}
                layout="vertical"
                verticalAlign="middle"
                align="right"
                formatter={(value: any) => (
                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{value}</span>
                )}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a2236',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#f1f5f9'
                }}
                formatter={(value: any) => [`${value}%`, 'Complétion']}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie chart */}
        <div className="chart-card">
          <h3>Répartition par Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {statusChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1a2236',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#f1f5f9'
                }}
              />
              <Legend
                formatter={(value: any) => (
                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2: Country + RC */}
      <h2 className="section-title animate-in delay-3">Répartition Géographique & RC</h2>
      <div className="charts-grid animate-in delay-3">
        {/* Country bar chart */}
        <div className="chart-card">
          <h3>Top Pays (nombre de clients)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={countryChartData} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" stroke="#64748b" fontSize={11} />
              <YAxis type="category" dataKey="name" width={100} stroke="#64748b" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={COLORS.accent} radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RC workload bar chart */}
        <div className="chart-card">
          <h3>Charge par RC (nombre de clients)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rcChartData} margin={{ bottom: 60 }}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-35} textAnchor="end" />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={COLORS.cyan} radius={[6, 6, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <h2 className="section-title animate-in delay-4">Données Détaillées</h2>
      <div className="filters-bar animate-in delay-4">
        <input
          className="search-input"
          type="text"
          placeholder="🔍  Rechercher un client, pays, RC..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select className="filter-select" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
          <option value="all">Tous les pays</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={rcFilter} onChange={e => setRcFilter(e.target.value)}>
          <option value="all">Tous les RC</option>
          {rcs.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={roaFilter} onChange={e => setRoaFilter(e.target.value)}>
          <option value="all">Tous les ROA</option>
          {roas.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Data Table */}
      <div className="table-wrapper animate-in delay-4">
        <div className="table-header-bar">
          <h3>Suivi Client</h3>
          <span className="table-count">{filteredData.length} résultats</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Mapping</th>
                <th>RC</th>
                <th>Pays</th>
                <th>Status</th>
                <th>Business Case</th>
                <th>Notion</th>
                <th>Contrat</th>
                <th>Reportings</th>
                <th>Coprod/Copil</th>
                <th>Costrat</th>
                <th>ROA</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    Aucune donnée trouvée
                  </td>
                </tr>
              ) : (
                filteredData.map((row, i) => (
                  <tr key={i}>
                    <td>{row.CLIENT || '—'}</td>
                    <td>{row.MAPPING || '—'}</td>
                    <td>{row.RC || '—'}</td>
                    <td>{row.COUNTRY || '—'}</td>
                    <td><span className={getBadgeClass(row.STATUS)}><span className="badge-dot" />{row.STATUS || '—'}</span></td>
                    <td><span className={getBadgeClass(row['Business Case'])}>{row['Business Case'] || '—'}</span></td>
                    <td><span className={getBadgeClass(row['UPDATE NOTION'])}>{row['UPDATE NOTION'] || '—'}</span></td>
                    <td><span className={getBadgeClass(row.CONTRAT)}>{row.CONTRAT || '—'}</span></td>
                    <td><span className={getBadgeClass(row['REPORTINGS 2025'])}>{row['REPORTINGS 2025'] || '—'}</span></td>
                    <td><span className={getBadgeClass(row['COPROD/COPIL'])}>{row['COPROD/COPIL'] || '—'}</span></td>
                    <td><span className={getBadgeClass(row.COSTRAT)}>{row.COSTRAT || '—'}</span></td>
                    <td>{row.ROA || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '32px 0 16px',
        color: '#64748b',
        fontSize: '0.7rem'
      }}>
        BC Follow-Up Dashboard · Auto-refresh toutes les 30s · Données depuis Google Sheets
      </footer>
    </div>
  )
}
