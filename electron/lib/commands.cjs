// 命令工具函数：runCommand / checkCommandExists / findScrcpyPath
// 这三个工具被 ADB 模块和窗口/对话框等模块复用

const { exec } = require('child_process');

// Run a shell command and return a Promise
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout ? stdout.trim() : stderr.trim());
    });
  });
}

// Check if a command exists
function checkCommandExists(command) {
  return new Promise((resolve) => {
    exec(`${command} --version`, (error) => {
      resolve(!error);
    });
  });
}

// Find scrcpy path
function findScrcpyPath() {
  return new Promise((resolve) => {
    exec('where scrcpy', (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        resolve(stdout.trim().split('\n')[0]);
      }
    });
  });
}

module.exports = { runCommand, checkCommandExists, findScrcpyPath };
