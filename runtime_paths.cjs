const path = require('node:path');
const { homedir } = require('node:os');

module.exports = function runtimePaths() {
  const home = process.env.DSH_HOME || path.join(homedir(), '.dsh');
  const dataDir = path.resolve(process.env.DSH_SHOT_DATA_DIR || path.join(home, 'desktop', 'screenshot'));
  return { dataDir, tempDir: path.join(dataDir, 'tmp'),
    preferences: process.env.DSH_SHOT_PREFERENCES_PATH || path.join(dataDir, 'preferences.json'),
    userData: process.env.DSH_SHOT_USER_DATA_PATH || path.join(dataDir, 'user_data'),
    captures: path.join(dataDir, 'captures') };
};
