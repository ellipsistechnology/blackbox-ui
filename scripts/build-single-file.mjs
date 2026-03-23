import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distDir = path.resolve(__dirname, '../dist')
const htmlPath = path.join(distDir, 'index.html')
const outputPath = path.join(distDir, 'index.standalone.html')

const mimeTypes = {
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
} 

function stripQueryAndHash(url) {
  return url.split('?')[0].split('#')[0]
}

function getMimeType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function textToDataUrl(content, mimeType) {
  return `data:${mimeType};base64,${Buffer.from(content, 'utf8').toString('base64')}`
}

function resolveDistAssetPath(assetUrl, fromFile = htmlPath) {
  const cleanUrl = stripQueryAndHash(assetUrl)

  if(cleanUrl.startsWith('/')) {
    return path.join(distDir, cleanUrl.slice(1))
  }

  return path.resolve(path.dirname(fromFile), cleanUrl)
}

async function toDataUrl(filePath) {
  const buffer = await readFile(filePath)
  const mimeType = getMimeType(filePath)
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function inlineCssAssets(css, cssFilePath) {
  const matches = [...css.matchAll(/url\((['"]?)([^'"\)]+)\1\)/g)]
  let inlinedCss = css

  for(const match of matches) {
    const original = match[0]
    const assetUrl = match[2]

    if(!assetUrl || assetUrl.startsWith('data:') || assetUrl.startsWith('http://') || assetUrl.startsWith('https://') || assetUrl.startsWith('#')) {
      continue
    }

    const assetPath = resolveDistAssetPath(assetUrl, cssFilePath)
    const dataUrl = await toDataUrl(assetPath)
    inlinedCss = inlinedCss.replace(original, `url("${dataUrl}")`)
  }

  return inlinedCss
}

async function buildStandaloneHtml() {
  let html = await readFile(htmlPath, 'utf8')

  const iconMatch = html.match(/<link([^>]*?)rel=["']icon["']([^>]*?)href=["']([^"']+)["']([^>]*?)>/i)
  if(iconMatch) {
    const [fullMatch, before, middle, href, after] = iconMatch
    const iconPath = resolveDistAssetPath(href)
    const dataUrl = await toDataUrl(iconPath)
    html = html.replace(fullMatch, `<link${before}rel="icon"${middle}href="${dataUrl}"${after}>`)
  }

  const stylesheetMatches = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g)]
  for(const match of stylesheetMatches) {
    const [fullMatch, href] = match
    const cssPath = resolveDistAssetPath(href)
    const css = await readFile(cssPath, 'utf8')
    const inlinedCss = await inlineCssAssets(css, cssPath)
    const cssDataUrl = textToDataUrl(inlinedCss, 'text/css')
    html = html.replace(fullMatch, fullMatch.replace(href, cssDataUrl))
  }

  const scriptMatches = [...html.matchAll(/<script([^>]*?)src=["']([^"']+)["']([^>]*)><\/script>/g)]
  for(const match of scriptMatches) {
    const [fullMatch, before, src, after] = match
    const scriptPath = resolveDistAssetPath(src)
    const script = await readFile(scriptPath, 'utf8')
    const scriptDataUrl = textToDataUrl(script, 'text/javascript')
    html = html.replace(fullMatch, `<script${before}src="${scriptDataUrl}"${after}></script>`)
  }

  await writeFile(outputPath, html, 'utf8')
  console.log(`Created standalone build artifact: ${path.relative(process.cwd(), outputPath)}`)
}

await buildStandaloneHtml()
