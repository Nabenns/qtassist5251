const { google } = require('googleapis');

/**
 * Initialize Google Drive API client
 */
function getGoogleDriveClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!serviceAccountEmail || !privateKey) {
    console.warn('⚠️ Google Drive not configured. Auto-share disabled.');
    return null;
  }

  const auth = new google.auth.JWT(
    serviceAccountEmail,
    null,
    privateKey,
    [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file'
    ]
  );

  const drive = google.drive({ version: 'v3', auth });

  return { drive, auth };
}

/**
 * Share Google Drive folder/file dengan email
 * @param {string} fileId - Google Drive file/folder ID
 * @param {string} email - Email address to share with
 * @param {string} role - Permission role (reader, writer, etc)
 * @returns {Promise<object>} - Permission object
 */
async function shareDriveFile(fileId, email, role = 'reader') {
  const client = getGoogleDriveClient();
  if (!client) return null;

  const { drive } = client;

  try {
    // Check if user already has access
    const existingPermissions = await drive.permissions.list({
      fileId: fileId,
      fields: 'permissions(id, emailAddress, role)'
    });

    const existing = existingPermissions.data.permissions?.find(
      p => p.emailAddress === email
    );

    if (existing) {
      console.log(`📧 Email ${email} already has access to Drive file/folder`);
      return existing;
    }

    // Create permission
    const permission = await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        type: 'user',
        role: role,
        emailAddress: email
      },
      sendNotificationEmail: true,
      emailMessage: 'Kamu telah mendapat akses ke konten eksklusif! Cek email kamu untuk link akses.'
    });

    console.log(`✅ Shared Drive file/folder with ${email}`);
    return permission.data;

  } catch (error) {
    console.error(`❌ Error sharing Drive file with ${email}:`, error.message);
    throw error;
  }
}

/**
 * Revoke akses Google Drive dari email
 * @param {string} fileId - Google Drive file/folder ID
 * @param {string} email - Email address to revoke
 * @returns {Promise<boolean>} - Success status
 */
async function revokeDriveAccess(fileId, email) {
  const client = getGoogleDriveClient();
  if (!client) return false;

  const { drive } = client;

  try {
    // Get all permissions
    const permissions = await drive.permissions.list({
      fileId: fileId,
      fields: 'permissions(id, emailAddress)'
    });

    // Find permission for this email
    const permission = permissions.data.permissions?.find(
      p => p.emailAddress === email
    );

    if (!permission) {
      console.log(`📧 Email ${email} doesn't have access to revoke`);
      return false;
    }

    // Delete permission
    await drive.permissions.delete({
      fileId: fileId,
      permissionId: permission.id
    });

    console.log(`✅ Revoked Drive access from ${email}`);
    return true;

  } catch (error) {
    console.error(`❌ Error revoking Drive access from ${email}:`, error.message);
    throw error;
  }
}

/**
 * Get Drive file/folder info
 * @param {string} fileId - Google Drive file/folder ID
 * @returns {Promise<object>} - File metadata
 */
async function getDriveFileInfo(fileId) {
  const client = getGoogleDriveClient();
  if (!client) return null;

  const { drive } = client;

  try {
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, webViewLink, createdTime'
    });

    return file.data;

  } catch (error) {
    console.error(`❌ Error getting Drive file info:`, error.message);
    throw error;
  }
}

/**
 * Share multiple Drive files/folders dengan email
 * @param {string[]} fileIds - Array of Google Drive file/folder IDs
 * @param {string} email - Email address to share with
 * @param {string} role - Permission role
 * @returns {Promise<object[]>} - Array of permission objects
 */
async function shareMultipleDriveFiles(fileIds, email, role = 'reader') {
  const results = [];

  for (const fileId of fileIds) {
    try {
      const permission = await shareDriveFile(fileId, email, role);
      results.push({ fileId, success: true, permission });
    } catch (error) {
      results.push({ fileId, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Revoke akses dari multiple Drive files/folders
 * @param {string[]} fileIds - Array of Google Drive file/folder IDs
 * @param {string} email - Email address to revoke
 * @returns {Promise<object[]>} - Array of results
 */
async function revokeMultipleDriveAccess(fileIds, email) {
  const results = [];

  for (const fileId of fileIds) {
    try {
      const success = await revokeDriveAccess(fileId, email);
      results.push({ fileId, success });
    } catch (error) {
      results.push({ fileId, success: false, error: error.message });
    }
  }

  return results;
}

module.exports = {
  getGoogleDriveClient,
  shareDriveFile,
  revokeDriveAccess,
  getDriveFileInfo,
  shareMultipleDriveFiles,
  revokeMultipleDriveAccess
};
