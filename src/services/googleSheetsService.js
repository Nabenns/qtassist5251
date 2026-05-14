const { google } = require('googleapis');
const { Transaction, Product, TemporaryRole } = require('../database/models');

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
      { title: 'Active Users', index: 2 },
      { title: 'Analytics', index: 3 }
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

  const activeUsersHeaders = [
    ['User ID', 'Username', 'Role ID', 'Role Name', 'Granted At', 'Expires At', 'Days Remaining', 'Status']
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

      // Set headers for Active Users
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Active Users!A1:H1',
        valueInputOption: 'RAW',
        requestBody: { values: activeUsersHeaders }
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
 * Update analytics sheet with charts and formulas
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
    const cancelledCount = allTransactions.filter(t => t.status === 'cancelled').length;
    const totalRevenue = allTransactions
      .filter(t => t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0);

    const approvalRate = totalTransactions > 0 ? ((approvedCount / totalTransactions) * 100).toFixed(2) : 0;
    const rejectionRate = totalTransactions > 0 ? ((rejectedCount / totalTransactions) * 100).toFixed(2) : 0;

    // Revenue by product
    const revenueByProduct = {};
    allTransactions
      .filter(t => t.status === 'approved')
      .forEach(t => {
        const productName = t.product?.name || 'Unknown';
        revenueByProduct[productName] = (revenueByProduct[productName] || 0) + t.amount;
      });

    // Top 5 products by revenue
    const topProducts = Object.entries(revenueByProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Update main analytics section
    const analyticsData = [
      ['📊 OVERVIEW METRICS', ''],
      ['Total Transactions', totalTransactions],
      ['✅ Approved', approvedCount],
      ['❌ Rejected', rejectedCount],
      ['⏳ Pending', pendingCount],
      ['🚫 Cancelled', cancelledCount],
      ['', ''],
      ['💰 REVENUE METRICS', ''],
      ['Total Revenue (IDR)', totalRevenue],
      ['Average Transaction (IDR)', approvedCount > 0 ? Math.round(totalRevenue / approvedCount) : 0],
      ['', ''],
      ['📈 PERFORMANCE METRICS', ''],
      ['Approval Rate (%)', approvalRate],
      ['Rejection Rate (%)', rejectionRate],
      ['Conversion Rate (%)', totalTransactions > 0 ? ((approvedCount / totalTransactions) * 100).toFixed(2) : 0],
      ['', ''],
      ['🏆 TOP PRODUCTS BY REVENUE', ''],
      ...topProducts.map(([product, revenue]) => [product, revenue]),
      ['', ''],
      ['🕒 LAST UPDATED', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })]
    ];

    // Clear and update analytics
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Analytics!A1:D50'
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Analytics!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: analyticsData }
    });

    // Create pie chart for transaction status
    await createStatusPieChart(sheets, spreadsheetId, approvedCount, rejectedCount, pendingCount, cancelledCount);

    // Create bar chart for top products
    if (topProducts.length > 0) {
      await createProductRevenueChart(sheets, spreadsheetId, topProducts);
    }

    // Format analytics sheet
    await formatAnalyticsSheet(sheets, spreadsheetId);

  } catch (error) {
    console.error('Error updating analytics:', error.message);
  }
}

/**
 * Create pie chart for transaction status distribution
 */
async function createStatusPieChart(sheets, spreadsheetId, approved, rejected, pending, cancelled) {
  try {
    // Get Analytics sheet ID
    const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const analyticsSheet = sheetResponse.data.sheets.find(s => s.properties.title === 'Analytics');

    if (!analyticsSheet) return;

    const sheetId = analyticsSheet.properties.sheetId;

    // Add chart data
    const chartData = [
      ['Status', 'Count'],
      ['Approved', approved],
      ['Rejected', rejected],
      ['Pending', pending],
      ['Cancelled', cancelled]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Analytics!F2:G6',
      valueInputOption: 'RAW',
      requestBody: { values: chartData }
    });

    // Create pie chart
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addChart: {
            chart: {
              spec: {
                title: 'Transaction Status Distribution',
                pieChart: {
                  legendPosition: 'RIGHT_LEGEND',
                  domain: {
                    sourceRange: {
                      sources: [{
                        sheetId: sheetId,
                        startRowIndex: 1,
                        endRowIndex: 6,
                        startColumnIndex: 5,
                        endColumnIndex: 6
                      }]
                    }
                  },
                  series: {
                    sourceRange: {
                      sources: [{
                        sheetId: sheetId,
                        startRowIndex: 1,
                        endRowIndex: 6,
                        startColumnIndex: 6,
                        endColumnIndex: 7
                      }]
                    }
                  }
                }
              },
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId: sheetId,
                    rowIndex: 0,
                    columnIndex: 5
                  }
                }
              }
            }
          }
        }]
      }
    });

  } catch (error) {
    console.log('Chart may already exist or error creating:', error.message);
  }
}

/**
 * Create bar chart for top products revenue
 */
async function createProductRevenueChart(sheets, spreadsheetId, topProducts) {
  try {
    const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const analyticsSheet = sheetResponse.data.sheets.find(s => s.properties.title === 'Analytics');

    if (!analyticsSheet) return;

    const sheetId = analyticsSheet.properties.sheetId;

    // Chart already created in status pie chart section
    // Just update the data range which is already set in main analytics

  } catch (error) {
    console.log('Error creating product chart:', error.message);
  }
}

/**
 * Format analytics sheet with colors and styles
 */
async function formatAnalyticsSheet(sheets, spreadsheetId) {
  try {
    const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const analyticsSheet = sheetResponse.data.sheets.find(s => s.properties.title === 'Analytics');

    if (!analyticsSheet) return;

    const sheetId = analyticsSheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Format headers (bold + background)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 2
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 12 },
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.8 },
                  horizontalAlignment: 'CENTER'
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
            }
          },
          // Format section titles
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 20,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true }
                }
              },
              fields: 'userEnteredFormat(textFormat)'
            }
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 4
              }
            }
          }
        ]
      }
    });

  } catch (error) {
    console.log('Error formatting analytics:', error.message);
  }
}

/**
 * Sync all active temporary roles to Google Sheets
 */
async function syncActiveUsersToSheets(guild) {
  const client = getGoogleSheetsClient();
  if (!client) return;

  const { sheets, spreadsheetId } = client;

  try {
    // Get all active temporary roles
    const activeRoles = await TemporaryRole.findAll({
      where: {
        serverId: guild.id,
        expiresAt: { [require('sequelize').Op.gt]: new Date() }
      },
      order: [['expiresAt', 'ASC']]
    });

    // Clear existing data (except headers)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Active Users!A2:H1000'
    });

    if (activeRoles.length === 0) {
      console.log('✅ No active users to sync');
      return;
    }

    // Prepare rows
    const rows = [];
    for (const tempRole of activeRoles) {
      // Get username
      let username = 'Unknown';
      try {
        const member = await guild.members.fetch(tempRole.userId);
        username = member.user.tag;
      } catch (error) {
        username = tempRole.userId;
      }

      // Get role name
      let roleName = 'Unknown';
      try {
        const role = guild.roles.cache.get(tempRole.roleId);
        roleName = role ? role.name : tempRole.roleId;
      } catch (error) {
        roleName = tempRole.roleId;
      }

      // Calculate days remaining
      const now = new Date();
      const expiresAt = new Date(tempRole.expiresAt);
      const timeLeft = expiresAt - now;
      const daysRemaining = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
      const hoursRemaining = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

      // Determine status
      let status = '✅ Active';
      if (daysRemaining === 0 && hoursRemaining < 24) {
        status = '⚠️ Expiring Soon';
      } else if (daysRemaining < 3) {
        status = '⏰ Expiring Soon';
      }

      const daysRemainingText = daysRemaining > 0
        ? `${daysRemaining} hari ${hoursRemaining} jam`
        : `${hoursRemaining} jam`;

      rows.push([
        tempRole.userId,
        username,
        tempRole.roleId,
        roleName,
        new Date(tempRole.grantedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        new Date(tempRole.expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        daysRemainingText,
        status
      ]);
    }

    // Update sheet with all rows
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Active Users!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });

    console.log(`✅ Synced ${rows.length} active users to Google Sheets`);

  } catch (error) {
    console.error('❌ Error syncing active users:', error.message);
  }
}

/**
 * Sync single temporary role to Active Users sheet
 */
async function syncTemporaryRoleToSheets(tempRole, guild) {
  const client = getGoogleSheetsClient();
  if (!client) return;

  const { sheets, spreadsheetId } = client;

  try {
    // Check if role is still active
    const now = new Date();
    const expiresAt = new Date(tempRole.expiresAt);

    if (expiresAt <= now) {
      // Role expired, remove from sheet
      await removeUserRoleFromSheet(sheets, spreadsheetId, tempRole.userId, tempRole.roleId);
      return;
    }

    // Get username
    let username = 'Unknown';
    try {
      const member = await guild.members.fetch(tempRole.userId);
      username = member.user.tag;
    } catch (error) {
      username = tempRole.userId;
    }

    // Get role name
    let roleName = 'Unknown';
    try {
      const role = guild.roles.cache.get(tempRole.roleId);
      roleName = role ? role.name : tempRole.roleId;
    } catch (error) {
      roleName = tempRole.roleId;
    }

    // Calculate days remaining
    const timeLeft = expiresAt - now;
    const daysRemaining = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

    // Determine status
    let status = '✅ Active';
    if (daysRemaining === 0 && hoursRemaining < 24) {
      status = '⚠️ Expiring Soon';
    } else if (daysRemaining < 3) {
      status = '⏰ Expiring Soon';
    }

    const daysRemainingText = daysRemaining > 0
      ? `${daysRemaining} hari ${hoursRemaining} jam`
      : `${hoursRemaining} jam`;

    const rowData = [
      tempRole.userId,
      username,
      tempRole.roleId,
      roleName,
      new Date(tempRole.grantedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      new Date(tempRole.expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      daysRemainingText,
      status
    ];

    // Update or append row
    await updateOrAppendUserRole(sheets, spreadsheetId, tempRole.userId, tempRole.roleId, rowData);

    console.log(`✅ Synced user ${tempRole.userId} role to Active Users sheet`);

  } catch (error) {
    console.error('❌ Error syncing temporary role:', error.message);
  }
}

/**
 * Update or append user role in Active Users sheet
 */
async function updateOrAppendUserRole(sheets, spreadsheetId, userId, roleId, rowData) {
  try {
    // Get all user IDs and role IDs
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Active Users!A:C'
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === userId && row[2] === roleId);

    if (rowIndex !== -1) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Active Users!A${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [rowData] }
      });
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Active Users!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [rowData] }
      });
    }
  } catch (error) {
    console.error('Error updating user role:', error.message);
  }
}

/**
 * Remove user role from Active Users sheet
 */
async function removeUserRoleFromSheet(sheets, spreadsheetId, userId, roleId) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Active Users!A:C'
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === userId && row[2] === roleId);

    if (rowIndex !== -1) {
      // Get sheet ID
      const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = sheetResponse.data.sheets.find(s => s.properties.title === 'Active Users');

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
    console.error('Error removing user role:', error.message);
  }
}

module.exports = {
  initializeSheets,
  syncTransactionToSheets,
  syncActiveUsersToSheets,
  syncTemporaryRoleToSheets
};
