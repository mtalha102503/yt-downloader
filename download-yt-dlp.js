const { execSync } = require('child_process');
const os = require('os');

if (os.platform() === 'win32') {
  console.log('Downloading yt-dlp.exe for Windows...');
  execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o yt-dlp.exe', { stdio: 'inherit' });
} else {
  console.log('Downloading yt-dlp for Unix-like system...');
  execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o yt-dlp && chmod +x yt-dlp', { stdio: 'inherit' });
}
