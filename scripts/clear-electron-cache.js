const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Clear electron-builder cache that causes symlink issues
const electronBuilderCache = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache');

console.log('Clearing electron-builder cache to fix symlink permission issues...');

if (fs.existsSync(electronBuilderCache)) {
  try {
    // Remove winCodeSign cache specifically (this is what causes the symlink issue)
    const winCodeSignPath = path.join(electronBuilderCache, 'winCodeSign');
    if (fs.existsSync(winCodeSignPath)) {
      console.log('Removing winCodeSign cache...');
      
      // Try to remove using PowerShell with force (more reliable on Windows)
      try {
        if (process.platform === 'win32') {
          execSync(`powershell -Command "Remove-Item -Path '${winCodeSignPath.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' });
        } else {
          fs.rmSync(winCodeSignPath, { recursive: true, force: true });
        }
        console.log('✓ winCodeSign cache cleared');
      } catch (rmError) {
        // If PowerShell fails, try regular fs.rmSync
        try {
          fs.rmSync(winCodeSignPath, { recursive: true, force: true });
          console.log('✓ winCodeSign cache cleared (using fs.rmSync)');
        } catch (fsError) {
          console.warn('⚠ Could not clear winCodeSign cache automatically.');
          console.warn('  Please manually delete:', winCodeSignPath);
          console.warn('  Or run PowerShell as Administrator and execute:');
          console.warn(`  Remove-Item -Recurse -Force "${winCodeSignPath}"`);
        }
      }
    } else {
      console.log('No winCodeSign cache found (already cleared)');
    }
  } catch (error) {
    console.warn('Warning: Could not clear cache:', error.message);
    console.log('You may need to manually delete:', electronBuilderCache);
  }
} else {
  console.log('No electron-builder cache found');
}

console.log('Cache clearing complete.');
console.log('');
console.log('Note: If you still encounter symlink errors, you can:');
console.log('  1. Enable Developer Mode in Windows Settings');
console.log('  2. Run the build command as Administrator');
console.log('  3. The build will continue even if winCodeSign extraction fails (code signing is disabled)');

