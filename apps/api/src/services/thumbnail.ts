import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { getLocalFilePath, uploadDir } from './storage'

const THUMB_DIR = path.join(uploadDir, '.thumbs')
const THUMB_WIDTH = 480

/**
 * Get (or generate) a cached thumbnail for an image key.
 * Returns the absolute path to the thumbnail, or null if not possible.
 */
export async function getThumbnailPath(key: string): Promise<string | null> {
  const srcPath = getLocalFilePath(key)
  if (!srcPath || !fs.existsSync(srcPath)) return null

  const ext = path.extname(srcPath).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return null

  fs.mkdirSync(THUMB_DIR, { recursive: true })
  const thumbPath = path.join(THUMB_DIR, `${key}.webp`)

  // Serve cached thumbnail if it exists and is newer than the source
  if (fs.existsSync(thumbPath)) {
    if (fs.statSync(thumbPath).mtimeMs >= fs.statSync(srcPath).mtimeMs) {
      return thumbPath
    }
  }

  // Generate thumbnail
  await sharp(srcPath)
    .rotate() // respect EXIF orientation
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(thumbPath)

  return thumbPath
}
