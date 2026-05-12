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
  accent: '#5b5fc7',
  success: '#2ea043',
  warning: '#cf8b17',
  danger: '#cf3030',
  info: '#3d7dd9',
  purple: '#8b7ec8',
  cyan: '#3d9dc4',
  pink: '#b05a8a',
}

const PIE_COLORS = ['#5b5fc7', '#2ea043', '#cf8b17', '#cf3030', '#3d7dd9', '#8b7ec8', '#3d9dc4', '#b05a8a', '#c07030', '#2a8a6a']

// Country config with flags and accent colors
const COUNTRY_CONFIG = [
  { key: 'Maroc', flag: '🇲🇦', color: '#b03030', gradient: 'linear-gradient(135deg, #8b2020, #b03030)' },
  { key: 'Tunis', flag: '🇹🇳', color: '#2e6ab0', gradient: 'linear-gradient(135deg, #1e4a80, #2e6ab0)' },
  { key: 'France', flag: '🇫🇷', color: '#4a4e9e', gradient: 'linear-gradient(135deg, #363a7a, #4a4e9e)' },
  { key: 'Madagascar', flag: '🇲🇬', color: '#1e7a4a', gradient: 'linear-gradient(135deg, #145a35, #1e7a4a)' },
]

function computeCountryKpis(rows: SheetRow[]) {
  const total = rows.length
  if (total === 0) return { total: 0, bcPct: 0, notionPct: 0, archivagePct: 0, contratPct: 0, reportingPct: 0, coprodPct: 0, costratPct: 0 }
  const is = (val: string) => val?.trim().toLowerCase() === 'complet'
  const bc = rows.filter(r => is(r['Business Case'])).length
  const notion = rows.filter(r => is(r['UPDATE NOTION'])).length
  const contrat = rows.filter(r => is(r.CONTRAT)).length
  const reporting = rows.filter(r => is(r['REPORTINGS 2025'])).length
  const coprod = rows.filter(r => is(r['COPROD/COPIL'])).length
  const costrat = rows.filter(r => is(r.COSTRAT)).length
  const archivage = rows.filter(r => is(r.CONTRAT) && is(r['REPORTINGS 2025']) && is(r['COPROD/COPIL']) && is(r.COSTRAT)).length
  return {
    total,
    bcPct: Math.round((bc / total) * 100),
    notionPct: Math.round((notion / total) * 100),
    archivagePct: Math.round((archivage / total) * 100),
    contratPct: Math.round((contrat / total) * 100),
    reportingPct: Math.round((reporting / total) * 100),
    coprodPct: Math.round((coprod / total) * 100),
    costratPct: Math.round((costrat / total) * 100),
  }
}

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL = 30000

export default function DashboardPage() {
  const [data, setData] = useState<SheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)

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

  // Per-country KPIs (always computed from ALL data, not filtered)
  const countryMetrics = useMemo(() => {
    return COUNTRY_CONFIG.map(cfg => {
      const rows = data.filter(r => (r.COUNTRY || '').trim().toLowerCase().includes(cfg.key.toLowerCase()))
      return { ...cfg, kpis: computeCountryKpis(rows) }
    })
  }, [data])

  // Country comparison bar chart data
  const countryCompareData = useMemo(() => {
    return countryMetrics.map(c => ({
      name: c.flag + ' ' + c.key,
      'Business Case': c.kpis.bcPct,
      'Notion': c.kpis.notionPct,
      'Archivage': c.kpis.archivagePct,
      'Contrat': c.kpis.contratPct,
    }))
  }, [countryMetrics])

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

  // Copy email report
  const copyEmailReport = useCallback(async () => {
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    const isComp = (val: string) => val?.trim().toLowerCase() === 'complet'

    // Build missing items per country
    const countryDetails = COUNTRY_CONFIG.map(cfg => {
      const rows = data.filter(r => (r.COUNTRY || '').trim().toLowerCase().includes(cfg.key.toLowerCase()))
      const ck = computeCountryKpis(rows)
      const missing = rows.filter(r => !isComp(r['Business Case']) || !isComp(r['UPDATE NOTION']) || !isComp(r.CONTRAT) || !isComp(r['REPORTINGS 2025']) || !isComp(r['COPROD/COPIL']) || !isComp(r.COSTRAT))
      return { ...cfg, kpis: ck, rows, missing }
    })

    // Build the bar helper
    const bar = (pct: number, color: string) =>
      `<div style="background:#e5e7eb;border-radius:4px;height:8px;width:100%;margin-top:2px;"><div style="background:${color};height:8px;border-radius:4px;width:${pct}%;"></div></div>`

    // Global summary
    const totalAll = data.length
    const bcAll = data.filter(r => isComp(r['Business Case'])).length
    const notAll = data.filter(r => isComp(r['UPDATE NOTION'])).length
    const archAll = data.filter(r => isComp(r.CONTRAT) && isComp(r['REPORTINGS 2025']) && isComp(r['COPROD/COPIL']) && isComp(r.COSTRAT)).length

    let html = `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:720px;margin:0 auto;background:#ffffff;color:#1a1a1a;padding:32px;">
  <h1 style="margin:0 0 4px;font-size:22px;color:#1a1a1a;">📊 Follow-Up DRC — Rapport du ${today}</h1>
  <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">Généré automatiquement depuis le tableau de suivi</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:12px 16px;background:#f0f4ff;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#4f46e5;">${totalAll}</div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Total Clients</div>
      </td>
      <td style="width:12px;"></td>
      <td style="padding:12px 16px;background:#ecfdf5;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#059669;">${totalAll ? Math.round((bcAll/totalAll)*100) : 0}%</div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Business Case</div>
      </td>
      <td style="width:12px;"></td>
      <td style="padding:12px 16px;background:#faf5ff;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#7c3aed;">${totalAll ? Math.round((notAll/totalAll)*100) : 0}%</div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Update Notion</div>
      </td>
      <td style="width:12px;"></td>
      <td style="padding:12px 16px;background:#eff6ff;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#2563eb;">${totalAll ? Math.round((archAll/totalAll)*100) : 0}%</div>
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Archivage</div>
      </td>
    </tr>
  </table>

  <h2 style="font-size:16px;margin:0 0 16px;color:#1a1a1a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Détail par Pays</h2>
`

    countryDetails.forEach(c => {
      html += `
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <tr>
      <td colspan="3" style="padding:10px 16px;background:${c.gradient};color:#fff;font-weight:700;font-size:15px;">
        ${c.flag} ${c.key} — <span style="font-weight:400;font-size:13px;">${c.kpis.total} clients</span>
      </td>
    </tr>
    <tr style="background:#f9fafb;">
      <td style="padding:8px 16px;font-size:12px;color:#374151;width:40%;">Business Case</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#059669;width:15%;text-align:right;">${c.kpis.bcPct}%</td>
      <td style="padding:8px 16px;width:45%;">${bar(c.kpis.bcPct, '#10b981')}</td>
    </tr>
    <tr>
      <td style="padding:8px 16px;font-size:12px;color:#374151;">Update Notion</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#7c3aed;text-align:right;">${c.kpis.notionPct}%</td>
      <td style="padding:8px 16px;">${bar(c.kpis.notionPct, '#a855f7')}</td>
    </tr>
    <tr style="background:#f9fafb;">
      <td style="padding:8px 16px;font-size:12px;color:#374151;">Archivage</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#4f46e5;text-align:right;">${c.kpis.archivagePct}%</td>
      <td style="padding:8px 16px;">${bar(c.kpis.archivagePct, '#6366f1')}</td>
    </tr>
    <tr>
      <td style="padding:8px 16px;font-size:12px;color:#374151;">Contrat</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#2563eb;text-align:right;">${c.kpis.contratPct}%</td>
      <td style="padding:8px 16px;">${bar(c.kpis.contratPct, '#3b82f6')}</td>
    </tr>
    <tr style="background:#f9fafb;">
      <td style="padding:8px 16px;font-size:12px;color:#374151;">Reportings 2025</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#0891b2;text-align:right;">${c.kpis.reportingPct}%</td>
      <td style="padding:8px 16px;">${bar(c.kpis.reportingPct, '#06b6d4')}</td>
    </tr>
    <tr>
      <td style="padding:8px 16px;font-size:12px;color:#374151;">Costrat</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#d97706;text-align:right;">${c.kpis.costratPct}%</td>
      <td style="padding:8px 16px;">${bar(c.kpis.costratPct, '#f59e0b')}</td>
    </tr>
  </table>
`
    })

    // Actions needed section
    html += `
  <h2 style="font-size:16px;margin:24px 0 12px;color:#dc2626;border-bottom:2px solid #fecaca;padding-bottom:8px;">⚠️ Actions requises</h2>
`
    countryDetails.forEach(c => {
      if (c.missing.length === 0) return
      html += `<p style="font-size:13px;font-weight:700;color:#1a1a1a;margin:12px 0 6px;">${c.flag} ${c.key} — ${c.missing.length} client(s) incomplet(s)</p>`
      html += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">`
      html += `<tr style="background:#fef2f2;"><th style="padding:6px 10px;text-align:left;color:#991b1b;border-bottom:1px solid #fecaca;">Client</th><th style="padding:6px 10px;text-align:center;color:#991b1b;border-bottom:1px solid #fecaca;">BC</th><th style="padding:6px 10px;text-align:center;color:#991b1b;border-bottom:1px solid #fecaca;">Notion</th><th style="padding:6px 10px;text-align:center;color:#991b1b;border-bottom:1px solid #fecaca;">Contrat</th><th style="padding:6px 10px;text-align:center;color:#991b1b;border-bottom:1px solid #fecaca;">Report.</th><th style="padding:6px 10px;text-align:center;color:#991b1b;border-bottom:1px solid #fecaca;">Coprod</th><th style="padding:6px 10px;text-align:center;color:#991b1b;border-bottom:1px solid #fecaca;">Costrat</th></tr>`
      c.missing.slice(0, 15).forEach(r => {
        const icon = (v: string) => isComp(v) ? '✅' : '❌'
        html += `<tr><td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;">${r.CLIENT || '—'}</td><td style="padding:4px 10px;text-align:center;border-bottom:1px solid #f3f4f6;">${icon(r['Business Case'])}</td><td style="padding:4px 10px;text-align:center;border-bottom:1px solid #f3f4f6;">${icon(r['UPDATE NOTION'])}</td><td style="padding:4px 10px;text-align:center;border-bottom:1px solid #f3f4f6;">${icon(r.CONTRAT)}</td><td style="padding:4px 10px;text-align:center;border-bottom:1px solid #f3f4f6;">${icon(r['REPORTINGS 2025'])}</td><td style="padding:4px 10px;text-align:center;border-bottom:1px solid #f3f4f6;">${icon(r['COPROD/COPIL'])}</td><td style="padding:4px 10px;text-align:center;border-bottom:1px solid #f3f4f6;">${icon(r.COSTRAT)}</td></tr>`
      })
      if (c.missing.length > 15) {
        html += `<tr><td colspan="7" style="padding:6px 10px;color:#6b7280;font-style:italic;">... et ${c.missing.length - 15} autre(s)</td></tr>`
      }
      html += `</table>`
    })

    html += `
  <p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center;">Rapport généré le ${today} depuis BC Follow-Up Dashboard</p>
</div>`

    // Copy as rich text HTML
    try {
      const blob = new Blob([html], { type: 'text/html' })
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([`BC Follow-Up Rapport — ${today}`], { type: 'text/plain' }) })
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (_e) {
      // Fallback: copy as plain text
      const plain = `BC Follow-Up Rapport — ${today}\n\nTotal: ${totalAll} clients\nBC: ${totalAll ? Math.round((bcAll/totalAll)*100) : 0}% | Notion: ${totalAll ? Math.round((notAll/totalAll)*100) : 0}% | Archivage: ${totalAll ? Math.round((archAll/totalAll)*100) : 0}%\n\n` +
        countryDetails.map(c => `${c.flag} ${c.key}: ${c.kpis.total} clients — BC ${c.kpis.bcPct}%, Notion ${c.kpis.notionPct}%, Archivage ${c.kpis.archivagePct}%`).join('\n')
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }, [data])

  // Custom tooltip
  const CustomTooltip = (props: any) => {
    const { active, payload, label } = props
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#111116',
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
      {/* Background watermarks */}
      <div className="bg-watermark bg-watermark-left" />
      <div className="bg-watermark bg-watermark-right" />

      {/* Header */}
      <header className="header animate-in">
        <div className="header-left">
          <img src="/Outsourcia Full.svg" alt="Outsourcia" className="header-logo" />
          <div>
            <h1>BC Follow-Up Dashboard</h1>
            <p>Suivi opérationnel des Business Cases</p>
          </div>
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
          <button className="copy-email-btn" onClick={copyEmailReport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? 'Copié !' : 'Copier Rapport'}
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
          {error} — Les données affichées peuvent être obsolètes.
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

      {/* Country Breakdown Section */}
      <h2 className="section-title animate-in delay-2">Métriques par Pays</h2>
      <div className="country-grid animate-in delay-2">
        {countryMetrics.map(c => (
          <div key={c.key} className="country-card">
            <div className="country-card-header" style={{ background: c.gradient }}>
              <span className="country-flag">{c.flag}</span>
              <div>
                <h3 className="country-name">{c.key}</h3>
                <p className="country-count">{c.kpis.total} clients</p>
              </div>
            </div>
            <div className="country-card-body">
              <div className="country-metric">
                <div className="country-metric-header">
                  <span>Business Case</span>
                  <span className="country-metric-value">{c.kpis.bcPct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.kpis.bcPct}%`, background: COLORS.success }} /></div>
              </div>
              <div className="country-metric">
                <div className="country-metric-header">
                  <span>Update Notion</span>
                  <span className="country-metric-value">{c.kpis.notionPct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.kpis.notionPct}%`, background: COLORS.purple }} /></div>
              </div>
              <div className="country-metric">
                <div className="country-metric-header">
                  <span>Archivage</span>
                  <span className="country-metric-value">{c.kpis.archivagePct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.kpis.archivagePct}%`, background: COLORS.accent }} /></div>
              </div>
              <div className="country-metric">
                <div className="country-metric-header">
                  <span>Contrat</span>
                  <span className="country-metric-value">{c.kpis.contratPct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.kpis.contratPct}%`, background: COLORS.info }} /></div>
              </div>
              <div className="country-metric">
                <div className="country-metric-header">
                  <span>Reportings</span>
                  <span className="country-metric-value">{c.kpis.reportingPct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.kpis.reportingPct}%`, background: COLORS.cyan }} /></div>
              </div>
              <div className="country-metric">
                <div className="country-metric-header">
                  <span>Costrat</span>
                  <span className="country-metric-value">{c.kpis.costratPct}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${c.kpis.costratPct}%`, background: COLORS.warning }} /></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Country Comparison Chart */}
      <div className="charts-grid animate-in delay-2" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3>Comparaison par Pays — Taux de complétion (%)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={countryCompareData} margin={{ bottom: 10 }}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: '#111116',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: '#f1f5f9'
                }}
                formatter={(value: any) => [`${value}%`]}
              />
              <Legend
                formatter={(value: any) => (
                  <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{value}</span>
                )}
              />
              <Bar dataKey="Business Case" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Notion" fill={COLORS.purple} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Archivage" fill={COLORS.accent} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Contrat" fill={COLORS.info} radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 1: Gauges + Status Breakdown */}
      <h2 className="section-title animate-in delay-2">Indicateurs de Complétion Globaux</h2>
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
                background={{ fill: '#18181f' } as any}
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
                  background: '#111116',
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
                  background: '#111116',
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
          placeholder="Rechercher un client, pays, RC..."
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

      <footer style={{
        textAlign: 'center',
        padding: '24px 0 12px',
        color: '#55556a',
        fontSize: '0.65rem',
        letterSpacing: '0.02em'
      }}>
        BC Follow-Up Dashboard · Actualisation auto. 30s · Source: Google Sheets
      </footer>
    </div>
  )
}
