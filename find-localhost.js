const fs = require('fs');
const path = require('path');

const searchDir = path.resolve(__dirname);  // Your project root directory
const searchTerm = 'localhost:5000';

function searchFiles(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      searchFiles(fullPath); // Recursive search in subfolders
    } else if (/\.(js|ejs|html|css)$/.test(file)) { // Check only relevant file types
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(searchTerm)) {
        console.log(`Found "${searchTerm}" in: ${fullPath}`);
      }
    }
  });
}

searchFiles(searchDir);
