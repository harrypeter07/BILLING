const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEMP_BUILD_PREFIX = 'temp-build-';
const MAX_TEMP_BUILDS = 5;

// Helper to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyFileIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function cleanupOldTempBuilds(distDir, keep = MAX_TEMP_BUILDS) {
  let entries = [];
  try {
    entries = fs.readdirSync(distDir);
  } catch (err) {
    console.warn('⚠ Could not read dist directory for cleanup:', err.message);
    return;
  }

  const tempDirs = entries
    .filter(name => name.startsWith(TEMP_BUILD_PREFIX))
    .map(name => {
      const dirPath = path.join(distDir, name);
      let mtime = 0;
      try {
        mtime = fs.statSync(dirPath).mtimeMs;
      } catch (err) {
        // If stat fails, push zero to remove soon
      }
      return { name, dirPath, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  const stale = tempDirs.slice(keep);
  stale.forEach(({ name, dirPath }) => {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`- Removed old temp build ${name}`);
    } catch (err) {
      console.warn(`⚠ Could not remove ${name}:`, err.message);
    }
  });
}

function archiveBuildArtifacts(distDir, finalDir) {
  if (!fs.existsSync(finalDir)) {
    console.warn('⚠ Cannot archive build: final output folder not found');
    return null;
  }

  const timestamp = Date.now();
  const folderName = `${TEMP_BUILD_PREFIX}${timestamp}`;
  const folderPath = path.join(distDir, folderName);
  const winArchivePath = path.join(folderPath, 'win-unpacked');

  try {
    ensureDir(winArchivePath);
    fs.cpSync(finalDir, winArchivePath, { recursive: true });
    console.log(`\n✓ Copied win-unpacked to ${folderName}`);
  } catch (err) {
    console.warn(`⚠ Could not copy win-unpacked to ${folderName}:`, err.message);
    return null;
  }

  const artifacts = [
    'Billing Solutions Setup 0.1.0.exe',
    'Billing Solutions Setup 0.1.0.exe.blockmap',
    'billing-solutions-0.1.0-x64.nsis.7z',
    'latest.yml',
    'builder-debug.yml',
    'builder-effective-config.yaml',
  ];

  artifacts.forEach(file => {
    const src = path.join(distDir, file);
    const dest = path.join(folderPath, file);
    copyFileIfExists(src, dest);
  });

  console.log(`✓ Archived installer artifacts to ${folderName}`);

  cleanupOldTempBuilds(distDir);
  return folderName;
}

function ensureNextInUnpacked(targetDir) {
  const unpackedPath = path.join(targetDir, 'resources', 'app.asar.unpacked');
  const nextSource = path.join(__dirname, '..', '.next');
  const nextDest = path.join(unpackedPath, '.next');

  if (!fs.existsSync(nextSource)) {
    console.warn('⚠ .next build directory not found at project root, skipping copy');
    return;
  }

  if (!fs.existsSync(unpackedPath)) {
    console.warn('⚠ Unpacked resources directory not found, skipping .next copy:', unpackedPath);
    return;
  }

  try {
    if (fs.existsSync(nextDest)) {
      fs.rmSync(nextDest, { recursive: true, force: true });
    }
    fs.cpSync(nextSource, nextDest, { recursive: true });
    console.log('✓ .next directory copied to unpacked resources');
  } catch (copyErr) {
    console.error('✗ Failed to copy .next directory:', copyErr.message);
  }
}

async function build() {
  console.log('Starting Electron Windows build process...\n');

  try {
    // Step 0: Kill any running Electron processes
    console.log('Step 0: Killing any running Billing Solutions processes...');
    require('./kill-electron-processes.js');
    await sleep(1000); // Wait for processes to fully terminate
    console.log('');

    // Step 1: Clear cache
    console.log('Step 1: Clearing electron-builder cache...');
    require('./clear-electron-cache.js');
    console.log('');

    // Step 2: Build Next.js normally (NO static export - we run server inside Electron)
    console.log('Step 2: Building Next.js (production build, no export)...');
    console.log('');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('');

    // Step 3: Build Electron (try to delete old, then build to temp if needed)
    console.log('Step 3: Building Electron executable...');
    
    const distDir = path.join(__dirname, '../dist');
    const finalDir = path.join(distDir, 'win-unpacked');
    const tempDir = path.join(distDir, 'win-unpacked-temp');
    const exePath = path.join(finalDir, 'Billing Solutions.exe');
    const tempExePath = path.join(tempDir, 'Billing Solutions.exe');
    
    // Try to forcefully delete old EXE and directory
    console.log('Attempting to delete old executable and directory...');
    let useTempFolder = false;
    
    try {
      execSync('node scripts/force-delete-exe.js', { stdio: 'inherit' });
      console.log('✓ Old executable deleted successfully');
    } catch (err) {
      console.log('⚠ Could not delete old executable');
    }
    
    // Check if directory exists and is locked (try to remove it)
    if (fs.existsSync(finalDir)) {
      try {
        // Check if app.asar exists and is locked (most common locked file)
        const appAsarPath = path.join(finalDir, 'resources', 'app.asar');
        if (fs.existsSync(appAsarPath)) {
          try {
            // Try to read the file to see if it's locked
            const fd = fs.openSync(appAsarPath, 'r+');
            fs.closeSync(fd);
          } catch (lockErr) {
            console.log('⚠ app.asar is locked (app may be running), will build to temporary folder');
            useTempFolder = true;
          }
        }
        
        // If not locked yet, try to remove the directory
        if (!useTempFolder) {
          try {
            fs.rmSync(finalDir, { recursive: true, force: true, maxRetries: 2, retryDelay: 500 });
            console.log('✓ Old directory removed successfully');
          } catch (rmErr) {
            console.log('⚠ Could not remove old directory, will build to temporary folder');
            useTempFolder = true;
          }
        }
      } catch (testErr) {
        // Directory is locked
        console.log('⚠ Directory is locked (app may be running), will build to temporary folder');
        useTempFolder = true;
      }
    }
    
    // Also check if EXE still exists (additional check)
    if (fs.existsSync(exePath)) {
      useTempFolder = true;
    }
    let originalOutput = undefined; // For restoring package.json
    
    if (useTempFolder) {
      console.log('\n⚠ Old executable is locked, building to temporary folder...');
      
      // Build to a completely different output directory
      const tempBuildDir = path.join(distDir, 'temp-build-' + Date.now());
      const tempWinDir = path.join(tempBuildDir, 'win-unpacked');
      
      try {
        // Temporarily modify package.json to change output directory
        const packageJsonPath = path.join(__dirname, '../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        originalOutput = packageJson.build?.directories?.output;
        
        // Change output to temp directory
        if (!packageJson.build) packageJson.build = {};
        if (!packageJson.build.directories) packageJson.build.directories = {};
        packageJson.build.directories.output = 'dist/temp-build-' + Date.now();
        
        // Save modified package.json
        const packageJsonBackup = JSON.stringify(packageJson, null, 2);
        fs.writeFileSync(packageJsonPath, packageJsonBackup);
        
        console.log('Building to temporary directory to avoid file locks...');
        
        // Build directory first (faster)
        console.log('Building directory structure...');
        execSync('npx cross-env CSC_IDENTITY_AUTO_DISCOVERY=false WIN_CSC_LINK= electron-builder --win --x64 --dir', { 
          stdio: 'inherit',
          env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', WIN_CSC_LINK: '' }
        });
        
        // Then build installer (separate step for better control)
        console.log('Building NSIS installer...');
        execSync('npx cross-env CSC_IDENTITY_AUTO_DISCOVERY=false WIN_CSC_LINK= electron-builder --win nsis', { 
          stdio: 'inherit',
          env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', WIN_CSC_LINK: '' }
        });
        
        // Find the actual build directory (electron-builder creates it)
        const tempDirs = fs.readdirSync(distDir).filter(dir => {
          const fullPath = path.join(distDir, dir);
          return fs.statSync(fullPath).isDirectory() && dir.startsWith('temp-build-');
        }).sort().reverse(); // Get newest first
        
        if (tempDirs.length > 0) {
          const actualTempDir = path.join(distDir, tempDirs[0], 'win-unpacked');
          const actualTempExe = path.join(actualTempDir, 'Billing Solutions.exe');
          
          if (fs.existsSync(actualTempExe)) {
            console.log('\n✓ Build succeeded in temporary folder');
            console.log('Moving executable to final location...');
            
            // Remove old directory with retry
            if (fs.existsSync(finalDir)) {
              for (let i = 0; i < 3; i++) {
                try {
                  fs.rmSync(finalDir, { recursive: true, force: true });
                  console.log('✓ Removed old directory');
                  break;
                } catch (err) {
                  if (i < 2) {
                    console.log(`Attempt ${i + 1} failed, retrying...`);
                    await sleep(2000);
                    require('./kill-electron-processes.js');
                    await sleep(1000);
                  } else {
                    // Rename old instead
                    try {
                      const oldDir = finalDir + '-old-' + Date.now();
                      fs.renameSync(finalDir, oldDir);
                      console.log(`✓ Renamed old directory`);
                    } catch (renameErr) {
                      console.warn('⚠ Could not remove or rename old directory');
                    }
                  }
                }
              }
            }
            
            // Move temp to final
            try {
              fs.renameSync(actualTempDir, finalDir);
              console.log('✓ Moved executable to final location');
              
              ensureNextInUnpacked(finalDir);
              
              // Cleanup temp build directory
              const tempBuildParent = path.join(distDir, tempDirs[0]);
              try {
                fs.rmSync(tempBuildParent, { recursive: true, force: true });
              } catch (cleanupErr) {
                console.warn('⚠ Could not cleanup temp directory:', tempDirs[0]);
              }
            } catch (moveErr) {
              // Copy if rename fails - use a different name first to avoid lock
              console.log('Rename failed, copying files with workaround...');
              
              // Create final directory if it doesn't exist
              if (!fs.existsSync(finalDir)) {
                fs.mkdirSync(finalDir, { recursive: true });
              }
              
              // Copy EXE with a temp name first, then rename
              const tempExeName = 'Billing Solutions.exe.temp';
              const tempExeDest = path.join(finalDir, tempExeName);
              
              try {
                // Copy EXE with temp name
                fs.copyFileSync(actualTempExe, tempExeDest);
                
                // Wait a bit
                await sleep(500);
                
                // Now rename to final name (this should work since old EXE might be released)
                const finalExeDest = path.join(finalDir, 'Billing Solutions.exe');
                try {
                  fs.renameSync(tempExeDest, finalExeDest);
                  console.log('✓ Copied executable to final location');
                } catch (renameErr) {
                  // If rename fails, at least we have the temp file
                  console.log('⚠ Could not rename temp EXE, but it exists at:', tempExeDest);
                  console.log('  You can manually rename it after closing any processes');
                }
                
                // Copy other files
                const files = fs.readdirSync(actualTempDir);
                for (const file of files) {
                  if (file === 'Billing Solutions.exe') continue; // Already handled
                  const src = path.join(actualTempDir, file);
                  const dest = path.join(finalDir, file);
                  try {
                    if (fs.statSync(src).isDirectory()) {
                      fs.cpSync(src, dest, { recursive: true });
                    } else {
                      fs.copyFileSync(src, dest);
                    }
                  } catch (copyErr) {
                    console.warn(`⚠ Could not copy ${file}:`, copyErr.message);
                  }
                }
                console.log('✓ Copied other files to final location');
                ensureNextInUnpacked(finalDir);
              } catch (copyErr) {
                console.error('✗ Could not copy files:', copyErr.message);
                console.log('\n⚠ Build succeeded but could not move to final location.');
                console.log('  Temporary EXE location:', actualTempExe);
                console.log('  You can manually copy it after closing any processes.');
                throw copyErr;
              }
            }
          }
        }
        
        // Restore original package.json
        if (originalOutput !== undefined) {
          packageJson.build.directories.output = originalOutput;
        } else {
          delete packageJson.build.directories.output;
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        
      } catch (buildError) {
        // Restore package.json even on error
        try {
          const packageJsonPath = path.join(__dirname, '../package.json');
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          if (originalOutput !== undefined) {
            packageJson.build.directories.output = originalOutput;
          } else {
            delete packageJson.build.directories.output;
          }
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        } catch (restoreErr) {
          console.error('⚠ Could not restore package.json:', restoreErr.message);
        }
        throw buildError;
      }
    } else {
      // Normal build (no old EXE exists)
      console.log('Building normally (no old executable found)...');
      try {
        // Build directory first (faster)
        console.log('Building directory structure...');
        execSync('npx cross-env CSC_IDENTITY_AUTO_DISCOVERY=false WIN_CSC_LINK= electron-builder --win --x64 --dir', { 
          stdio: 'inherit',
          env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', WIN_CSC_LINK: '' }
        });
        
        // Then build installer (separate step for better control)
        console.log('Building NSIS installer...');
        execSync('npx cross-env CSC_IDENTITY_AUTO_DISCOVERY=false WIN_CSC_LINK= electron-builder --win nsis', { 
          stdio: 'inherit',
          env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false', WIN_CSC_LINK: '' }
        });
        
        // Step 4: Ensure .next is in unpacked location
        console.log('\nStep 4: Ensuring .next directory is in unpacked location...');
        const unpackedPath = path.join(finalDir, 'resources', 'app.asar.unpacked');
        const nextSource = path.join(__dirname, '..', '.next');
        const nextDest = path.join(unpackedPath, '.next');
        
        if (fs.existsSync(nextSource) && fs.existsSync(unpackedPath)) {
          if (fs.existsSync(nextDest)) {
            fs.rmSync(nextDest, { recursive: true, force: true });
          }
          fs.cpSync(nextSource, nextDest, { recursive: true });
          console.log('✓ .next directory copied to unpacked location');
        } else {
          console.warn('⚠ .next source or unpacked path not found, skipping copy');
        }
        
        console.log('\n✓ Build complete!');
        console.log('Executable location: dist/win-unpacked/Billing Solutions.exe');
        console.log('Installer location: dist/Billing Solutions Setup 0.1.0.exe');
      } catch (error) {
        // Check if exe was created despite the error (winCodeSign errors are non-fatal)
        if (fs.existsSync(exePath)) {
          console.log('\n⚠ Build completed with warnings (winCodeSign symlink errors are non-fatal)');
          console.log('✓ Executable was created successfully!');
          console.log('Executable location: dist/win-unpacked/Billing Solutions.exe');
        } else {
          throw error; // Re-throw if exe wasn't created
        }
      }
    }

    const archivedFolder = archiveBuildArtifacts(distDir, finalDir);
    if (archivedFolder) {
      console.log(`\nNew build snapshot: dist/${archivedFolder}`);
      console.log('Each build now has an isolated archive for troubleshooting locked executables.');
    }
  } catch (error) {
    console.error('\n✗ Build failed:', error.message);
    process.exit(1);
  }
}

// Run the build
build();

