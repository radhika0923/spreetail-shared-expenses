const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'client', 'src', 'components');

const replaceInFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('http://localhost:5000')) {
    let newContent = content;
    // We can just define a global or use import.meta.env directly.
    // The easiest way without adding an import is replacing 'http://localhost:5000' with a variable
    // Let's replace 'http://localhost:5000/api...' with \`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api...\`
    
    // Actually, simpler: replace all string literals
    newContent = newContent.replace(/'http:\/\/localhost:5000([^']*)'/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
    newContent = newContent.replace(/"http:\/\/localhost:5000([^"]*)"/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
    newContent = newContent.replace(/`http:\/\/localhost:5000([^`]*)`/g, "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`");
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

const walkSync = (dir) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walkSync(filepath);
    } else if (filepath.endsWith('.jsx')) {
      replaceInFile(filepath);
    }
  });
};

walkSync(directoryPath);
