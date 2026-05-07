import { NextResponse } from 'next/server'

// Google Sheets public CSV export URL
const SHEET_ID = '1tUuK6nwFUFGP0ttXrlcSSkPRWkahzt7Wup4PzN2l7kM'
const SHEET_NAME = 'repo'

// Columns in order
const HEADERS = [
  'CLIENT', 'MAPPING', 'RC', 'COUNTRY', 'STATUS',
  'UPDATE NOTION', 'Business Case', 'CONTRAT',
  'REPORTINGS 2025', 'COPROD/COPIL', 'COSTRAT', 'ROA'
]

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Use Google Sheets CSV export (works for publicly shared sheets)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`

    const response = await fetch(csvUrl, {
      cache: 'no-store',
      headers: {
        'Accept': 'text/csv',
      },
    })

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`)
    }

    const csvText = await response.text()
    const rows = parseCSV(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ data: [], headers: HEADERS, lastUpdated: new Date().toISOString(), totalRows: 0 })
    }

    // First row = headers from the sheet
    const sheetHeaders = rows[0]
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim() !== ''))

    // Map rows to objects using the expected headers
    const data = dataRows.map(row => {
      const obj: Record<string, string> = {}
      sheetHeaders.forEach((header, i) => {
        // Try to match to our known headers
        const normalizedHeader = header.trim().toUpperCase()
        const matchedHeader = HEADERS.find(h => h.toUpperCase() === normalizedHeader) || header.trim()
        obj[matchedHeader] = (row[i] || '').trim()
      })
      return obj
    })

    return NextResponse.json({
      data,
      headers: HEADERS,
      lastUpdated: new Date().toISOString(),
      totalRows: data.length,
    })
  } catch (error: unknown) {
    console.error('Error fetching Google Sheets data:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch data from Google Sheets', details: message },
      { status: 500 }
    )
  }
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++ // skip escaped quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(current)
        current = ''
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current)
        current = ''
        rows.push(row)
        row = []
        if (char === '\r') i++ // skip \n after \r
      } else {
        current += char
      }
    }
  }

  // push last field and row
  if (current || row.length > 0) {
    row.push(current)
    rows.push(row)
  }

  return rows
}
