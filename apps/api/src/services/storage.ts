import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export interface StoredFile {
  key: string
  url?: string
}

const driver = process.env.STORAGE_DRIVER ?? 'local'
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads')

let s3: S3Client | null = null
const s3Bucket = process.env.S3_BUCKET ?? ''

function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    })
  }
  return s3
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
): Promise<string> {
  const ext = path.extname(originalName) || ''
  const key = `${randomUUID()}${ext}`

  if (driver === 's3') {
    await getS3().send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    )
  } else {
    fs.mkdirSync(uploadDir, { recursive: true })
    fs.writeFileSync(path.join(uploadDir, key), buffer)
  }

  return key
}

export async function getFileUrl(key: string): Promise<string> {
  if (driver === 's3') {
    const cmd = new GetObjectCommand({ Bucket: s3Bucket, Key: key })
    return getSignedUrl(getS3(), cmd, { expiresIn: 3600 })
  }
  // Local: served via /api/files/:key
  return `/api/files/${encodeURIComponent(key)}`
}

export async function deleteFile(key: string): Promise<void> {
  if (driver === 's3') {
    await getS3().send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }))
  } else {
    const filePath = getLocalFilePath(key)
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
}

/**
 * Resolve a stored key to an absolute local file path.
 * Returns null if the key attempts path traversal outside uploadDir.
 */
export function getLocalFilePath(key: string): string | null {
  // Keys are UUIDs with an extension — reject anything with path separators
  if (key.includes('/') || key.includes('\\') || key.includes('..')) return null
  const resolved = path.resolve(uploadDir, key)
  // Ensure the resolved path stays within uploadDir
  if (!resolved.startsWith(uploadDir + path.sep) && resolved !== uploadDir) return null
  return resolved
}
