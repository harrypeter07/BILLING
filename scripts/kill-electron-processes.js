const { execSync, exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('Checking for running Billing Solutions processes...');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function killProcesses() {
  if (os.platform() === 'win32') {
    // Windows: More aggressive process killing
    const processesToKill = [
      'Billing Solutions.exe',
      'electron.exe',
      'Billing Solutions',
    ];

    for (const procName of processesToKill) {
      try {
        // Try multiple methods to kill the process
        execSync(`taskkill /F /IM "${procName}" 2>nul`, { stdio: 'ignore' });
        console.log(`✓ Attempted to kill ${procName}`);
      } catch (e) {
        // Process might not exist, that's okay
      }
    }

    // Also try to kill by PID if we can find them
    try {
      const tasklist = execSync('tasklist /FO CSV /NH', { encoding: 'utf-8' });
      const lines = tasklist.split('\n');
      for (const line of lines) {
        if (line.includes('Billing Solutions') || line.includes('electron.exe')) {
          const parts = line.split('","');
          if (parts.length > 1) {
            const pid = parts[1].replace(/"/g, '');
            try {
              execSync(`taskkill /F /PID ${pid} 2>nul`, { stdio: 'ignore' });
            } catch (e) {
              // Ignore
            }
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    // Wait a bit for processes to fully terminate
    await sleep(500);
  } else {
    // Unix-like systems
    try {
      execSync('pkill -9 -f "Billing Solutions" 2>/dev/null', { stdio: 'ignore' });
      execSync('pkill -9 -f "electron.*billing" 2>/dev/null', { stdio: 'ignore' });
      console.log('✓ Killed processes');
    } catch (e) {
      console.log('No processes found');
    }
  }
}

// Also try to unlock the file by closing any handles
async function unlockFile(filePath) {
  if (os.platform() === 'win32') {
    try {
      // Use handle.exe if available, or just wait
      execSync(`handle.exe "${filePath}" 2>nul`, { stdio: 'ignore' });
    } catch (e) {
      // handle.exe not available, that's okay
    }
  }
}

try {
  killProcesses().then(() => {
    // Also try to unlock the EXE file if it exists
    const exePath = path.join(__dirname, '../dist/win-unpacked/Billing Solutions.exe');
    if (fs.existsSync(exePath)) {
      unlockFile(exePath);
    }
    console.log('Process cleanup complete.');
  });
} catch (error) {
  console.warn('Warning: Could not kill processes:', error.message);
  console.log('You may need to manually close the application or restart your computer.');
}

