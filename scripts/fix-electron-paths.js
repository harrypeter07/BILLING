const fs = require('fs');
const path = require('path');

/**
 * Fixes absolute paths in Next.js static export HTML files to work with Electron's file:// protocol
 * Converts paths like /_next/static/... to relative paths like ./_next/static/... or ../_next/static/...
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
      // For license page: show fallback form if React doesn't hydrate
      electronScript = `
<script>
// Fallback license form for Electron if React doesn't hydrate
(function() {
  try {
    if (window.location.protocol === 'file:') {
      console.log('[Electron Fallback] License page loaded, waiting for React...');
      var reactLoaded = false;
      var checkInterval = setInterval(function() {
        // Check if React has loaded by looking for __next_f or React
        var nextRoot = document.querySelector('#__next');
        var hasContent = nextRoot && nextRoot.innerHTML && nextRoot.innerHTML.trim().length > 100;
        if (window.__next_f || window.React || document.querySelector('[data-reactroot]') || hasContent) {
          reactLoaded = true;
          clearInterval(checkInterval);
          console.log('[Electron Fallback] React loaded successfully');
        }
      }, 500);
      
      // After 3 seconds, if React hasn't loaded, show fallback form
      setTimeout(function() {
        if (!reactLoaded) {
          console.warn('[Electron Fallback] React did not load, showing fallback form');
          clearInterval(checkInterval);
          
          // Hide the React root and show fallback
          var root = document.getElementById('__next') || document.body;
          if (root) {
            var fallbackHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f5;padding:20px;"><div style="background:white;border-radius:8px;padding:32px;max-width:400px;width:100%;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><h1 style="text-align:center;margin:0 0 8px 0;font-size:24px;font-weight:600;">License Activation</h1><p style="text-align:center;color:#666;margin:0 0 24px 0;">Enter your license key to activate the application</p><form id="fallback-license-form" style="display:flex;flex-direction:column;gap:16px;"><div><label style="display:block;margin-bottom:8px;font-weight:500;">License Key <span style="color:red;">*</span></label><input type="text" id="fallback-license-key" required style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;font-family:monospace;" placeholder="ABC-123-XYZ" /></div><div><label style="display:block;margin-bottom:8px;font-weight:500;">Email (Optional)</label><input type="email" id="fallback-email" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;" placeholder="your@email.com" /></div><button type="submit" style="width:100%;padding:12px;background:#007bff;color:white;border:none;border-radius:4px;font-weight:500;cursor:pointer;">Activate License</button></form><div id="fallback-message" style="margin-top:16px;padding:12px;border-radius:4px;display:none;"></div></div></div>';
            root.innerHTML = fallbackHTML;
            
            // Add form handler
            document.getElementById('fallback-license-form').addEventListener('submit', function(e) {
              e.preventDefault();
              var key = document.getElementById('fallback-license-key').value;
              var email = document.getElementById('fallback-email').value;
              var msgDiv = document.getElementById('fallback-message');
              msgDiv.style.display = 'block';
              msgDiv.style.background = '#d4edda';
              msgDiv.style.color = '#155724';
              msgDiv.textContent = 'License activation is processing. Please restart the application.';
              // Store in localStorage as fallback
              try {
                localStorage.setItem('fallback_license_key', key);
                if (email) localStorage.setItem('fallback_license_email', email);
              } catch(err) {
                console.error('Could not save to localStorage:', err);
              }
            });
          }
        }
      }, 3000);
    }
  } catch (e) {
    console.error('[Electron Fallback] Error:', e);
  }
})();
</script>`;
    } else {
      // For root/index page: redirect to license if React doesn't hydrate
      electronScript = `
<script>
// Fallback redirect for Electron if React doesn't hydrate
(function() {
  try {
    if (window.location.protocol === 'file:') {
      var currentPath = window.location.pathname;
      if ((currentPath === '/' || currentPath.endsWith('/index.html') || currentPath === '') && 
          !currentPath.includes('license')) {
        console.log('[Electron Fallback] Detected Electron environment, will redirect to license page');
        setTimeout(function() {
          if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html') || 
              window.location.pathname === '' || window.location.pathname === currentPath) {
            console.log('[Electron Fallback] React did not hydrate, redirecting to license page');
            // Try multiple path formats for license page
            var licensePaths = ['./license/index.html', './license/', 'license/index.html', 'license/'];
            var currentBase = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
            // Try the first path, if it fails, the did-fail-load handler will catch it
            window.location.href = licensePaths[0];
          }
        }, 2000);
      }
    }
  } catch (e) {
    console.error('[Electron Fallback] Error:', e);
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

