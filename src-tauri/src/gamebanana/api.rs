use crate::gamebanana::models::{
    GameBananaCacheFile,
    GameBananaMod,
    GameBananaModDetails,
    GameBananaModDetailsCacheFile,
    GameBananaModsResponse,
};
use reqwest::blocking::Client;
use serde_json::Value;
use std::{
    fs,
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::Manager;

const CACHE_TTL_SECONDS: u64 = 60 * 30;
const MANUAL_REFRESH_COOLDOWN_SECONDS: u64 = 60;
const DETAILS_CACHE_TTL_SECONDS: u64 = 60 * 60 * 6;
const NTE_GAME_ID: u64 = 23012;
const PAGE_LIMIT: usize = 30;
const USER_AGENT: &str = "NTEMM/1.2.0 GameBanana Integration";

#[tauri::command(rename_all = "camelCase")]
pub async fn get_nte_mods(
    app: tauri::AppHandle,
    force_refresh: bool,
) -> Result<GameBananaModsResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_nte_mods_inner(app, force_refresh)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_mod_details(
    app: tauri::AppHandle,
    mod_id: u64,
    force_refresh: bool,
) -> Result<GameBananaModDetails, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_mod_details_inner(app, mod_id, force_refresh)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn response_json(value: reqwest::blocking::Response, context: &str) -> Result<Value, String> {
    let status = value.status();
    let text = value
        .text()
        .map_err(|e| format!("{context}: failed to read response body: {e}"))?;

    if !status.is_success() {
        return Err(format!("{context}: HTTP {status}: {text}"));
    }

    serde_json::from_str::<Value>(&text)
        .map_err(|e| format!("{context}: failed to parse JSON: {e}. Body: {text}"))
}

fn get_nte_mods_inner(
    app: tauri::AppHandle,
    force_refresh: bool,
) -> Result<GameBananaModsResponse, String> {
    let now = current_unix_time()?;
    let cache_path = cache_path(&app)?;

    if let Some(cache) = read_cache(&cache_path) {
        let age = now.saturating_sub(cache.saved_at);

        if !force_refresh && age <= CACHE_TTL_SECONDS {
            return Ok(GameBananaModsResponse {
                mods: cache.mods,
                cached: true,
                cache_age_seconds: age,
            });
        }

        if force_refresh && age <= MANUAL_REFRESH_COOLDOWN_SECONDS {
            return Ok(GameBananaModsResponse {
                mods: cache.mods,
                cached: true,
                cache_age_seconds: age,
            });
        }
    }

    let mods = fetch_nte_mods()?;

    write_cache(
        &cache_path,
        &GameBananaCacheFile {
            saved_at: now,
            mods: mods.clone(),
        },
    )?;

    Ok(GameBananaModsResponse {
        mods,
        cached: false,
        cache_age_seconds: 0,
    })
}

fn get_mod_details_inner(
    app: tauri::AppHandle,
    mod_id: u64,
    force_refresh: bool,
) -> Result<GameBananaModDetails, String> {
    let now = current_unix_time()?;
    let cache_path = details_cache_path(&app, mod_id)?;

    if let Some(cache) = read_details_cache(&cache_path) {
        let age = now.saturating_sub(cache.saved_at);

        if !force_refresh && age <= DETAILS_CACHE_TTL_SECONDS {
            return Ok(cache.details);
        }
    }

    let details = fetch_mod_details(mod_id)?;

    write_details_cache(
        &cache_path,
        &GameBananaModDetailsCacheFile {
            saved_at: now,
            details: details.clone(),
        },
    )?;

    Ok(details)
}

fn fetch_nte_mods() -> Result<Vec<GameBananaMod>, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to create GameBanana client: {e}"))?;

    let url = format!(
        "https://gamebanana.com/apiv11/Game/{}/Subfeed",
        NTE_GAME_ID
    );

    let response = client
        .get(url)
        .query(&[
            ("_nPage", "1"),
            ("_nPerpage", &PAGE_LIMIT.to_string()),
        ])
        .send()
        .map_err(|e| format!("Failed to request GameBanana mods: {e}"))?;

    let value = response_json(response, "GameBanana mods request failed")?;

    parse_v11_subfeed_mods(&value)
}

fn fetch_mod_details(mod_id: u64) -> Result<GameBananaModDetails, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Failed to create GameBanana client: {e}"))?;

    let response = client
        .get(format!("https://gamebanana.com/apiv11/Mod/{mod_id}"))
        .query(&[(
            "_csvProperties",
            "_idRow,_sName,_sProfileUrl,_sText,_aSubmitter,_aPreviewMedia,_aFiles",
        )])
        .send()
        .map_err(|e| format!("Failed to request GameBanana mod details: {e}"))?;

    let value = response_json(response, "GameBanana mod details request failed")?;

    parse_v11_mod_details(mod_id, &value)
}

fn parse_v11_subfeed_mods(value: &Value) -> Result<Vec<GameBananaMod>, String> {
    let records = value
        .as_array()
        .or_else(|| value.get("_aRecords").and_then(Value::as_array))
        .or_else(|| value.get("_aSubmissions").and_then(Value::as_array))
        .or_else(|| value.get("_aItems").and_then(Value::as_array))
        .or_else(|| value.get("records").and_then(Value::as_array))
        .ok_or_else(|| format!("Unexpected GameBanana response: {value}"))?;

    Ok(records
        .iter()
        .filter_map(parse_v11_mod_record)
        .take(PAGE_LIMIT)
        .collect())
}

fn parse_v11_mod_record(record: &Value) -> Option<GameBananaMod> {
    let id = value_u64_any(record, &["_idRow", "_idSubmission", "_idItem", "id"])?;

    let name = value_string_any(record, &["_sName", "_sTitle", "name", "title"])
        .unwrap_or_else(|| format!("Mod #{id}"));

    let description = cleanup_description(
        value_string_any(
            record,
            &["_sText", "_sDescription", "_sSummary", "_sExcerpt", "description"],
        )
        .unwrap_or_default(),
    );

    let owner_name = record
        .get("_aSubmitter")
        .and_then(|submitter| value_string_any(submitter, &["_sName", "name"]))
        .or_else(|| value_string_any(record, &["_sSubmitterName", "_sOwnerName", "ownerName"]))
        .unwrap_or_else(|| "Unknown".to_string());

    let page_url = value_string_any(record, &["_sProfileUrl", "_sUrl", "_sLink", "pageUrl"])
        .unwrap_or_else(|| format!("https://gamebanana.com/mods/{id}"));

    Some(GameBananaMod {
        id,
        name,
        description,
        owner_name,
        preview_image_url: find_v11_preview_image(record),
        page_url,
        likes: value_u64_any(
            record,
            &[
                "_nLikeCount",
                "_nLikes",
                "_nPostLikeCount",
                "_aStats._nLikeCount",
                "likes",
            ],
        )
        .unwrap_or(0),
        downloads: value_u64_any(
            record,
            &[
                "_nDownloadCount",
                "_nDownloads",
                "_aStats._nDownloadCount",
                "downloads",
            ],
        )
        .unwrap_or(0),
        date_added: value_u64_any(record, &["_tsDateAdded", "_tsDate", "_tsCreated", "dateAdded"])
            .unwrap_or(0),
        date_modified: value_u64_any(
            record,
            &["_tsDateModified", "_tsDateUpdated", "_tsUpdated", "dateModified"],
        )
        .unwrap_or(0),
    })
}

fn find_v11_preview_image(record: &Value) -> Option<String> {
    value_string_any(record, &["_sImageUrl", "_sPreviewUrl", "_sThumbnailUrl"])
        .or_else(|| {
            record
                .get("_aPreviewMedia")
                .and_then(|media| media.get("_aImages"))
                .and_then(Value::as_array)
                .and_then(|images| images.first())
                .and_then(build_v11_image_url)
        })
        .or_else(|| {
            record
                .get("_aPreviewMedia")
                .and_then(|media| media.get("_aMetadata"))
                .and_then(|metadata| value_string_any(metadata, &["_sImageUrl", "_sUrl"]))
        })
}

fn build_v11_image_url(image: &Value) -> Option<String> {
    if let Some(url) = value_string_any(image, &["_sUrl", "_sImageUrl"]) {
        return Some(url);
    }

    let base_url = value_string_any(image, &["_sBaseUrl"])?;
    let file = value_string_any(image, &["_sFile", "_sFilename"])?;

    Some(format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        file.trim_start_matches('/')
    ))
}

fn value_string_any(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        get_nested_value(value, key)
            .and_then(Value::as_str)
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
    })
}

fn value_u64_any(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        get_nested_value(value, key).and_then(|item| {
            item.as_u64()
                .or_else(|| item.as_i64().and_then(|number| u64::try_from(number).ok()))
                .or_else(|| item.as_str().and_then(|text| text.parse::<u64>().ok()))
        })
    })
}

fn get_nested_value<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    let mut current = value;

    for part in key.split('.') {
        current = current.get(part)?;
    }

    Some(current)
}

fn cleanup_description(description: String) -> String {
    let cleaned = description
        .replace("\r\n", "\n")
        .replace("[b]", "")
        .replace("[/b]", "")
        .replace("[i]", "")
        .replace("[/i]", "")
        .replace("[u]", "")
        .replace("[/u]", "")
        .trim()
        .to_string();

    const MAX_DESCRIPTION_LENGTH: usize = 180;

    if cleaned.chars().count() <= MAX_DESCRIPTION_LENGTH {
        return cleaned;
    }

    let mut shortened = cleaned.chars().take(MAX_DESCRIPTION_LENGTH).collect::<String>();
    shortened.push('…');
    shortened
}

fn parse_v11_mod_details(mod_id: u64, value: &Value) -> Result<GameBananaModDetails, String> {
    let id = value_u64_any(value, &["_idRow", "_idSubmission", "_idItem", "id"]).unwrap_or(mod_id);

    let name = value_string_any(value, &["_sName", "_sTitle", "name", "title"])
        .unwrap_or_else(|| format!("Mod #{id}"));

    let full_description = cleanup_full_description(
        value_string_any(
            value,
            &["_sText", "_sDescription", "_sSummary", "_sBody", "description"],
        )
        .unwrap_or_default(),
    );

    let owner_name = value
        .get("_aSubmitter")
        .and_then(|submitter| value_string_any(submitter, &["_sName", "name"]))
        .or_else(|| value_string_any(value, &["_sSubmitterName", "_sOwnerName", "ownerName"]))
        .unwrap_or_else(|| "Unknown".to_string());

    let preview_image_url = find_v11_preview_image(value);
    let screenshots = find_v11_screenshots(value);

    let page_url = value_string_any(value, &["_sProfileUrl", "_sUrl", "_sLink", "pageUrl"])
        .unwrap_or_else(|| format!("https://gamebanana.com/mods/{id}"));

    let (file_name, file_size, download_url) = find_v11_primary_file(value);

    Ok(GameBananaModDetails {
        id,
        name,
        description: cleanup_description(full_description.clone()),
        owner_name,
        preview_image_url,
        page_url,
        likes: value_u64_any(value, &["_nLikeCount", "_nLikes", "likes"]).unwrap_or(0),
        downloads: value_u64_any(value, &["_nDownloadCount", "_nDownloads", "downloads"])
            .unwrap_or(0),
        date_added: value_u64_any(value, &["_tsDateAdded", "_tsDate", "_tsCreated", "dateAdded"])
            .unwrap_or(0),
        date_modified: value_u64_any(
            value,
            &["_tsDateModified", "_tsDateUpdated", "_tsUpdated", "dateModified"],
        )
        .unwrap_or(0),
        full_description,
        screenshots,
        file_name,
        file_size,
        download_url,
    })
}

fn find_v11_screenshots(value: &Value) -> Vec<String> {
    value
        .get("_aPreviewMedia")
        .and_then(|media| media.get("_aImages"))
        .and_then(Value::as_array)
        .map(|images| {
            images
                .iter()
                .filter_map(build_v11_image_url)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn find_v11_primary_file(value: &Value) -> (String, u64, Option<String>) {
    let Some(files) = value.get("_aFiles") else {
        return (String::new(), 0, None);
    };

    let file = if let Some(array) = files.as_array() {
        array.first()
    } else if let Some(object) = files.as_object() {
        object.values().next()
    } else {
        None
    };

    let Some(file) = file else {
        return (String::new(), 0, None);
    };

    let file_name = value_string_any(
        file,
        &["_sFile", "_sFilename", "_sFileName", "_sDisplayName", "fileName"],
    )
    .unwrap_or_default();

    let file_size = value_u64_any(file, &["_nFilesize", "_nFileSize", "_nSize", "fileSize"])
        .unwrap_or(0);

    let download_url = value_string_any(
        file,
        &[
            "_sDownloadUrl",
            "_sDownloadURL",
            "_sDownloadLink",
            "_sUrl",
            "downloadUrl",
        ],
    );

    (file_name, file_size, download_url)
}

fn cleanup_full_description(description: String) -> String {
    description
        .replace("\r\n", "\n")
        .replace("[b]", "")
        .replace("[/b]", "")
        .replace("[i]", "")
        .replace("[/i]", "")
        .replace("[u]", "")
        .replace("[/u]", "")
        .replace("[url]", "")
        .replace("[/url]", "")
        .replace("[img]", "")
        .replace("[/img]", "")
        .trim()
        .to_string()
}

fn cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get app cache dir: {e}"))?
        .join("gamebanana");

    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create GameBanana cache dir: {e}"))?;

    Ok(cache_dir.join("nte_mods.json"))
}

fn read_cache(path: &PathBuf) -> Option<GameBananaCacheFile> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<GameBananaCacheFile>(&text).ok()
}

fn write_cache(path: &PathBuf, cache: &GameBananaCacheFile) -> Result<(), String> {
    let text = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize GameBanana cache: {e}"))?;

    fs::write(path, text).map_err(|e| format!("Failed to write GameBanana cache: {e}"))
}

fn current_unix_time() -> Result<u64, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System time error: {e}"))?
        .as_secs())
}

fn details_cache_path(
    app: &tauri::AppHandle,
    mod_id: u64,
) -> Result<PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get app cache dir: {e}"))?
        .join("gamebanana")
        .join("details");

    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create GameBanana details cache dir: {e}"))?;

    Ok(cache_dir.join(format!("{mod_id}.json")))
}

fn read_details_cache(path: &PathBuf) -> Option<GameBananaModDetailsCacheFile> {
    let text = fs::read_to_string(path).ok()?;
    serde_json::from_str::<GameBananaModDetailsCacheFile>(&text).ok()
}

fn write_details_cache(
    path: &PathBuf,
    cache: &GameBananaModDetailsCacheFile,
) -> Result<(), String> {
    let text = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize GameBanana details cache: {e}"))?;

    fs::write(path, text).map_err(|e| format!("Failed to write GameBanana details cache: {e}"))
}