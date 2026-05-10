const { google } = require('googleapis');
const { Transaction, Product } = require('../database/models');

// Initialize Google Sheets API
const getGoogleSheetsClient = () => {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!serviceAccountEmail || !privateKey || !spreadsheetId) {
    console.warn('⚠️ Google Sheets not configured. Skipping sync.');
    return null;
  }

  const auth = new google.auth.JWT(
    serviceAccountEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });

  return { sheets, spreadsheetId };
};

/**
 * Initialize sheet structure (create sheets if not exist)
 */
async function initializeSheets() {
  const client = getGoogleSheetsClient();
  if (!client) return;

  const { sheets, spreadsheetId } = client;

  try {
    // Get existing sheets
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = response.data.sheets.map(sheet => sheet.properties.title);

    const requiredSheets = [
      { title: 'Active Transactions', index: 0 },
      { title: 'Transaction History', index: 1 },
      { title: 'Analytics', index: 2 }
    ];

    // Create missing sheets
    const requests = [];

    for (const sheetInfo of requiredSheets) {
      if (!existingSheets.includes(sheetInfo.title)) {
        requests.push({
          addSheet: {
            properties: {
              title: sheetInfo.title,
              index: sheetInfo.index
            }
          }
        });
      }
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
      console.log('✅ Google Sheets structure initialized');
    }

    // Setup headers for each sheet
    await setupSheetHeaders(sheets, spreadsheetId);

  } catch (error) {
    console.error('❌ Error initializing Google Sheets:', error.message);
  }
}

/**
 * Setup headers for all sheets
 */
async function setupSheetHeaders(sheets, spreadsheetId) {
  const activeHeaders = [
    ['Order ID', 'User ID', 'Username', 'Product', 'Role', 'Amount (IDR)', 'Status', 'Created At', 'Payment Proof']
  ];

  const historyHeaders = [
    ['Order ID', 'User ID', 'Username', 'Product', 'Role', 'Amount (IDR)', 'Status', 'Created At', 'Reviewed By', 'Reviewed At', 'Rejection Reason', 'Payment Proof']
  ];

  const analyticsHeaders = [
    ['Metric', 'Value']
  ];

  try {
    // Check if headers already exist
    const activeCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Active Transactions!A1:I1'
    });

    if (!activeCheck.data.values || activeCheck.data.values.length === 0) {
      // Set headers for Active Transactions
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Active Transactions!A1:I1',
        valueInputOption: 'RAW',
        requestBody: { values: activeHeaders }
      });

      // Set headers for Transaction History
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Transaction History!A1:L1',
        valueInputOption: 'RAW',
        requestBody: { values: historyHeaders }
      });

      // Set headers for Analytics
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Analytics!A1:B1',
        valueInputOption: 'RAW',
        requestBody: { values: analyticsHeaders }
      });

      // Format headers (bold)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0, // Active Transactions
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                  }
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)'
              }
            }
          ]
        }
      });

      console.log('✅ Sheet headers configured');
    }
  } catch (error) {
    console.error('❌ Error setting up headers:', error.message);
  }
}

/**
 * Sync single transaction to Google Sheets
 */
async function syncTransactionToSheets(transaction, guild) {
  const client = getGoogleSheetsClient();
  if (!client) return;

  const { sheets, spreadsheetId } = client;

  try {
    // Get product info
    const product = transaction.product || await Product.findByPk(transaction.productId);
    if (!product) return;

    // Get user info
    let username = 'Unknown';
    try {
      const user = await guild.members.fetch(transaction.userId);
      username = user.user.tag;
    } catch (error) {
      username = transaction.userId;
    }

    // Get role name
    let roleName = 'Unknown';
    try {
      const role = guild.roles.cache.get(product.roleId);
      roleName = role ? role.name : product.roleId;
    } catch (error) {
      roleName = product.roleId;
    }

    // Prepare row data
    const rowData = [
      transaction.orderId,
      transaction.userId,
      username,
      product.name,
      roleName,
      transaction.amount,
      transaction.status,
      transaction.createdAt.toISOString(),
      transaction.paymentProofUrl || 'N/A'
    ];

    const historyRowData = [
      ...rowData,
      transaction.reviewedBy || 'N/A',
      transaction.reviewedAt ? transaction.reviewedAt.toISOString() : 'N/A',
      transaction.rejectionReason || 'N/A',
      transaction.paymentProofUrl || 'N/A'
    ];

    // Determine which sheet to update
    if (transaction.status === 'pending' || transaction.status === 'pending_review') {
      // Add/Update in Active Transactions
      await updateOrAppendRow(sheets, spreadsheetId, 'Active Transactions', transaction.orderId, rowData);
    } else {
      // Remove from Active Transactions
      await removeRowFromSheet(sheets, spreadsheetId, 'Active Transactions', transaction.orderId);

      // Add to Transaction History
      await updateOrAppendRow(sheets, spreadsheetId, 'Transaction History', transaction.orderId, historyRowData);
    }

    // Update analytics
    await updateAnalytics(sheets, spreadsheetId, guild);

    console.log(`✅ Synced transaction ${transaction.orderId} to Google Sheets`);

  } catch (error) {
    console.error('❌ Error syncing to Google Sheets:', error.message);
  }
}

/**
 * Update or append row in sheet
 */
async function updateOrAppendRow(sheets, spreadsheetId, sheetName, orderId, rowData) {
  try {
    // Get all data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === orderId);

    if (rowIndex !== -1) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] }
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:I`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] }
      });
    }
  } catch (error) {
    console.error(`Error updating row in ${sheetName}:`, error.message);
  }
}

/**
 * Remove row from sheet
 */
async function removeRowFromSheet(sheets, spreadsheetId, sheetName, orderId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === orderId);

    if (rowIndex !== -1) {
      // Get sheet ID
      const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = sheetResponse.data.sheets.find(s => s.properties.title === sheetName);

      if (sheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }]
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error removing row from ${sheetName}:`, error.message);
  }
}

/**
 * Update analytics sheet
 */
async function updateAnalytics(sheets, spreadsheetId, guild) {
  try {
    // Get all transactions
    const allTransactions = await Transaction.findAll({
      where: { serverId: guild.id },
      include: [{ model: Product, as: 'product' }]
    });

    // Calculate metrics
    const totalTransactions = allTransactions.length;
    const approvedCount = allTransactions.filter(t => t.status === 'approved').length;
    const rejectedCount = allTransactions.filter(t => t.status === 'rejected').length;
    const pendingCount = allTransactions.filter(t => t.status === 'pending' || t.status === 'pending_review').length;
    const totalRevenue = allTransactions
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    const approvalRate = totalTransactions > 0 ? ((approvedCount / totalTransactions) * 100).toFixed(2) : 0;

    // Update analytics data
    const analyticsData = [
      ['Total Transactions', totalTransactions],
      ['Approved', approvedCount],
      ['Rejected', rejectedCount],
      ['Pending', pendingCount],
      ['Total Revenue (IDR)', totalRevenue],
      ['Approval Rate (%)', approvalRate],
      ['Last Updated', new Date().toISOString()]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Analytics!A2:B8',
      valueInputOption: 'RAW',
      requestBody: { values: analyticsData }
    });

  } catch (error) {
    console.error('Error updating analytics:', error.message);
  }
}

module.exports = {
  initializeSheets,
  syncTransactionToSheets
};
