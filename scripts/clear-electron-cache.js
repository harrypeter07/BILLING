const fs = require('fs');
const path = require('path');
const os = require('os');

// Clear electron-builder cache that causes symlink issues
const electronBuilderCache = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache');

console.log('Clearing electron-builder cache to fix symlink permission issues...');

if (fs.existsSync(electronBuilderCache)) {
  try {
    // Remove winCodeSign cache specifically (this is what causes the symlink issue)
    const winCodeSignPath = path.join(electronBuilderCache, 'winCodeSign');
    if (fs.existsSync(winCodeSignPath)) {
      console.log('Removing winCodeSign cache...');
      fs.rmSync(winCodeSignPath, { recursive: true, force: true });
      console.log('✓ winCodeSign cache cleared');
    }
    
    // Optionally clear the entire cache if needed
    // Uncomment the lines below if you want to clear everything
    // fs.rmSync(electronBuilderCache, { recursive: true, force: true });
    // console.log('✓ Entire electron-builder cache cleared');
  } catch (error) {
    console.warn('Warning: Could not clear cache:', error.message);
    console.log('You may need to manually delete:', electronBuilderCache);
  }
} else {
  console.log('No electron-builder cache found');
}

console.log('Cache clearing complete.');

