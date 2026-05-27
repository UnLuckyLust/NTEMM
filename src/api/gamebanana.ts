import { invoke } from "@tauri-apps/api/core"
import type {
  ModDetails,
  ModsResponse,
} from "@/types/gamebanana"

export async function getNteMods(
  forceRefresh = false,
): Promise<ModsResponse> {
  return invoke<ModsResponse>("get_nte_mods", {
    forceRefresh,
  })
}

export async function getModDetails(
  modId: number,
  forceRefresh = false,
): Promise<ModDetails> {
  return invoke<ModDetails>("get_mod_details", {
    modId,
    forceRefresh,
  })
}