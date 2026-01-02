const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const exePath = path.join(__dirname, '../dist/win-unpacked/Billing Solutions.exe');
const distDir = path.join(__dirname, '../dist/win-unpacked');

console.log('Attempting to forcefully delete old executable...');

if (!fs.existsSync(exePath)) {
  console.log('No executable found, nothing to delete.');
  process.exit(0);
}

// Method 1: Try normal deletion
try {
  fs.unlinkSync(exePath);
  console.log('✓ Deleted using fs.unlinkSync');
  process.exit(0);
} catch (err) {
  console.log('Method 1 failed:', err.message);
}

// Method 2: Try PowerShell Remove-Item with force
if (os.platform() === 'win32') {
  try {
    const psCommand = `Remove-Item -Path "${exePath.replace(/"/g, '`"')}" -Force -ErrorAction Stop`;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'ignore' });
    console.log('✓ Deleted using PowerShell Remove-Item');
    process.exit(0);
  } catch (err) {
    console.log('Method 2 failed:', err.message);
  }
}

// Method 3: Try taskkill on any process using the file, then delete
if (os.platform() === 'win32') {
  try {
    // Find processes using the file
    execSync('taskkill /F /IM "Billing Solutions.exe" 2>nul', { stdio: 'ignore' });
    
    // Wait a bit
    const { execSync: execSyncSync } = require('child_process');
    execSyncSync('timeout /t 2 /nobreak >nul 2>&1', { stdio: 'ignore' });
    
    // Try deleting again
    fs.unlinkSync(exePath);
    console.log('✓ Deleted after killing processes');
    process.exit(0);
  } catch (err) {
    console.log('Method 3 failed:', err.message);
  }
}

// Method 4: Try renaming the entire directory
try {
  const oldDir = path.join(__dirname, '../dist/win-unpacked-old-' + Date.now());
  fs.renameSync(distDir, oldDir);
  console.log(`✓ Renamed directory to: ${path.basename(oldDir)}`);
  process.exit(0);
} catch (err) {
  console.log('Method 4 failed:', err.message);
}

// Method 5: Try using takeown and icacls to take ownership, then delete
if (os.platform() === 'win32') {
  try {
    execSync(`takeown /F "${exePath}" 2>nul`, { stdio: 'ignore' });
    execSync(`icacls "${exePath}" /grant ${os.userInfo().username}:F 2>nul`, { stdio: 'ignore' });
    fs.unlinkSync(exePath);
    console.log('✓ Deleted after taking ownership');
    process.exit(0);
  } catch (err) {
    console.log('Method 5 failed:', err.message);
  }
}

console.log('⚠ Could not delete executable. Will build to temporary folder instead.');
process.exit(1); // Signal failure so build script uses temp folder

