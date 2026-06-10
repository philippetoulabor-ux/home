import { chromium } from 'playwright'

const url = process.argv[2] || 'http://localhost:5174/'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []

page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)

console.log('URL:', url)
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none')
console.log('CANVAS:', (await page.$('canvas')) ? 'found' : 'missing')

await browser.close()
