/**
 * Google Apps Script — BC Follow-Up Dashboard Integration
 * ========================================================
 * 
 * This script serves two purposes:
 * 1. Publishes the "repo" sheet data as a JSON API (web app)
 * 2. Sends a webhook notification when the sheet is edited
 *
 * SETUP INSTRUCTIONS:
 * -------------------
 * 1. Open Google Sheets: https://docs.google.com/spreadsheets/d/1tUuK6nwFUFGP0ttXrlcSSkPRWkahzt7Wup4PzN2l7kM
 * 2. Go to Extensions > Apps Script
 * 3. Delete all existing code and paste this entire script
 * 4. Save (Ctrl+S)
 * 5. Deploy:
 *    a. Click "Deploy" > "New deployment"
 *    b. Type: "Web app"
 *    c. Execute as: "Me"
 *    d. Who has access: "Anyone"
 *    e. Click "Deploy"
 *    f. Copy the web app URL
 * 6. Set up the trigger:
 *    a. Click the clock icon (Triggers) in the left sidebar
 *    b. Click "+ Add Trigger"
 *    c. Function: onSheetEdit
 *    d. Event source: From spreadsheet
 *    e. Event type: On edit
 *    f. Click Save
 *
 * OPTIONAL: If you deploy the Next.js dashboard and want push updates,
 * update DASHBOARD_WEBHOOK_URL below with your deployment URL.
 */

// Configuration
var SHEET_NAME = "repo";
var DASHBOARD_WEBHOOK_URL = ""; // e.g., "https://your-dashboard.vercel.app/api/webhook"

/**
 * Handles GET requests — returns all data from the "repo" sheet as JSON
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Sheet '" + SHEET_NAME + "' not found" })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return ContentService.createTextOutput(
        JSON.stringify({ data: [], headers: [], lastUpdated: new Date().toISOString() })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // First row = headers
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Skip empty rows
      if (row.every(function(cell) { return String(cell).trim() === ""; })) continue;
      
      var obj = {};
      headers.forEach(function(header, j) {
        obj[header] = String(row[j] || "").trim();
      });
      rows.push(obj);
    }
    
    var result = {
      data: rows,
      headers: headers,
      lastUpdated: new Date().toISOString(),
      totalRows: rows.length,
      source: "Google Apps Script"
    };
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Triggered on edit — optionally sends a webhook to the dashboard
 */
function onSheetEdit(e) {
  // Only react to edits on the "repo" sheet
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  
  // Log the edit
  Logger.log("Sheet edited at: " + new Date().toISOString());
  Logger.log("Range: " + e.range.getA1Notation());
  
  // Send webhook notification if URL is configured
  if (DASHBOARD_WEBHOOK_URL) {
    try {
      var payload = {
        event: "sheet_edit",
        sheet: SHEET_NAME,
        range: e.range.getA1Notation(),
        timestamp: new Date().toISOString(),
        editedBy: Session.getActiveUser().getEmail()
      };
      
      UrlFetchApp.fetch(DASHBOARD_WEBHOOK_URL, {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      Logger.log("Webhook sent successfully");
    } catch (err) {
      Logger.log("Webhook failed: " + err.message);
    }
  }
}

/**
 * Creates a custom menu in Google Sheets for manual operations
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Dashboard')
    .addItem('🔄 Force Refresh Dashboard', 'forceRefreshDashboard')
    .addItem('📋 View Data Summary', 'showDataSummary')
    .addToUi();
}

/**
 * Manually triggers a dashboard refresh via webhook
 */
function forceRefreshDashboard() {
  if (!DASHBOARD_WEBHOOK_URL) {
    SpreadsheetApp.getUi().alert(
      "Webhook URL not configured.\n\n" +
      "The dashboard auto-refreshes every 30 seconds.\n" +
      "To enable push updates, set DASHBOARD_WEBHOOK_URL in the script."
    );
    return;
  }
  
  try {
    UrlFetchApp.fetch(DASHBOARD_WEBHOOK_URL, {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify({
        event: "manual_refresh",
        timestamp: new Date().toISOString()
      }),
      muteHttpExceptions: true
    });
    SpreadsheetApp.getUi().alert("✅ Dashboard refresh triggered!");
  } catch (err) {
    SpreadsheetApp.getUi().alert("❌ Failed: " + err.message);
  }
}

/**
 * Shows a summary of the current data
 */
function showDataSummary() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert("Sheet '" + SHEET_NAME + "' not found");
    return;
  }
  
  var data = sheet.getDataRange().getValues();
  var totalRows = data.length - 1; // exclude header
  
  var headers = data[0];
  var bcIdx = headers.indexOf("Business Case");
  var notionIdx = headers.indexOf("UPDATE NOTION");
  var contratIdx = headers.indexOf("CONTRAT");
  
  var bcComplete = 0, notionComplete = 0, contratComplete = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (bcIdx >= 0 && String(data[i][bcIdx]).trim().toLowerCase() === "complet") bcComplete++;
    if (notionIdx >= 0 && String(data[i][notionIdx]).trim().toLowerCase() === "complet") notionComplete++;
    if (contratIdx >= 0 && String(data[i][contratIdx]).trim().toLowerCase() === "complet") contratComplete++;
  }
  
  var msg = "📊 Data Summary\n" +
    "═══════════════\n\n" +
    "Total clients: " + totalRows + "\n" +
    "Business Case complets: " + bcComplete + "/" + totalRows + " (" + Math.round(bcComplete/totalRows*100) + "%)\n" +
    "Update Notion complets: " + notionComplete + "/" + totalRows + " (" + Math.round(notionComplete/totalRows*100) + "%)\n" +
    "Contrat complets: " + contratComplete + "/" + totalRows + " (" + Math.round(contratComplete/totalRows*100) + "%)\n";
  
  SpreadsheetApp.getUi().alert(msg);
}
