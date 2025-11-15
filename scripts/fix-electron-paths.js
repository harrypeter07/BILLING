const fs = require('fs');
const path = require('path');

/**
 * Fixes absolute paths in Next.js static export HTML files
 * NOTE: Since we're now using HTTP server (not file://), this script is mainly for compatibility
 * but paths should work with HTTP server as-is. Keeping this for any edge cases.
 */
function fixPathsInHtml(htmlContent, filePath) {
  const outDir = path.join(__dirname, '../out');
  const relativePath = path.relative(outDir, filePath);
  const depth = relativePath.split(path.sep).length - 1; // How many directories deep
  
  // Calculate relative path prefix (e.g., "" for root, "../" for one level deep, "../../" for two levels, etc.)
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  
  // Replace absolute paths with relative paths
  let fixed = htmlContent;
  
  // Fix /_next/ paths (most common)
  fixed = fixed.replace(/href="\/_next\//g, `href="${prefix}_next/`);
  fixed = fixed.replace(/src="\/_next\//g, `src="${prefix}_next/`);
  fixed = fixed.replace(/href='\/_next\//g, `href='${prefix}_next/`);
  fixed = fixed.replace(/src='\/_next\//g, `src='${prefix}_next/`);
  
  // Fix root-level paths (/, /favicon.ico, /manifest.json, etc.)
  // Only replace if it's a root path (starts with / and not /_next)
  fixed = fixed.replace(/href="\/(?!_next)([^"]+)"/g, `href="${prefix}$1"`);
  fixed = fixed.replace(/src="\/(?!_next)([^"]+)"/g, `src="${prefix}$1"`);
  fixed = fixed.replace(/href='\/(?!_next)([^']+)'/g, `href='${prefix}$1'`);
  fixed = fixed.replace(/src='\/(?!_next)([^']+)'/g, `src='${prefix}$1'`);
  
  // Fix paths in script content (for dynamic imports)
  fixed = fixed.replace(/["']\/_next\//g, `"${prefix}_next/`);
  fixed = fixed.replace(/["']\/(?!_next)([^"']+)/g, (match, p1) => {
    // Only replace if it looks like a path (not a protocol or special path)
    if (!p1.match(/^(https?:|mailto:|tel:|#|javascript:)/)) {
      return `"${prefix}${p1}`;
    }
    return match;
  });
  
  // For all HTML files, add inline script to handle Electron fallbacks
  if (filePath.endsWith('index.html') || filePath.endsWith('\\index.html')) {
    const isLicensePage = filePath.includes('license');
    let electronScript = '';
    
    if (isLicensePage) {
      // For license page: simple logging (HTTP server handles everything)
      electronScript = `
<script>
// Electron environment detection for license page
(function() {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('[Electron] License page loaded via HTTP server');
    }
  } catch (e) {
    console.error('[Electron Fallback] Error:', e);
  }
})();
</script>`;
    } else {
      // For root/index page: Simple logging only (HTTP server handles everything)
      electronScript = `
<script>
// Electron environment detection and logging
(function() {
  try {
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('[Electron] Detected Electron environment');
      console.log('[Electron] Using HTTP server:', window.location.href);
    }
  } catch (e) {
    console.error('[Electron] Error:', e);
  }
})();
</script>`;
    }
    
    // Insert script right after <head> tag
    fixed = fixed.replace(/<head[^>]*>/, `$&${electronScript}`);
  }
  
  return fixed;
}

/**
 * Recursively process all HTML files in a directory
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and other non-HTML directories
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        processDirectory(fullPath);
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      try {
        console.log(`Fixing paths in: ${path.relative(path.join(__dirname, '../out'), fullPath)}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        const fixed = fixPathsInHtml(content, fullPath);
        fs.writeFileSync(fullPath, fixed, 'utf8');
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error.message);
      }
    }
  }
}

// Main execution
const outDir = path.join(__dirname, '../out');

if (!fs.existsSync(outDir)) {
  console.error('Error: out directory not found. Run Next.js build first.');
  process.exit(1);
}

console.log('Fixing absolute paths in HTML files for Electron file:// protocol...');
processDirectory(outDir);
console.log('✓ All HTML files processed');

