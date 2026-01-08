export async function getPackageInfo() {
  const packageInfo = require('../../package.json')
  return packageInfo
}
