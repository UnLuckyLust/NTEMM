export interface Mod {
  id: number
  name: string
  description: string
  ownerName: string
  previewImageUrl: string | null
  pageUrl: string
  likes: number
  downloads: number
  dateAdded: number
  dateModified: number
}

export interface ModsResponse {
  mods: Mod[]
  cached: boolean
  cacheAgeSeconds: number
}

export interface ModDetails extends Mod {
  fullDescription: string
  screenshots: string[]
  fileName: string
  fileSize: number
  downloadUrl: string | null
}