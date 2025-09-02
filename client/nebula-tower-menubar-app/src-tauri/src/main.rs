#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use anyhow::{anyhow, Context, Result};
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{fs::OpenOptions, io::{Write, stdout, stderr}, path::PathBuf, process::Stdio, time::Duration, env};
use tauri::{CustomMenuItem, Manager, Runtime, SystemTray, SystemTrayEvent, SystemTrayMenu};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
    time,
};
use reqwest::Client;
use std::io::Cursor;
use zip::ZipArchive;
use tempfile::NamedTempFile;

static STATE: Lazy<Mutex<AppState>> = Lazy::new(|| Mutex::new(AppState::default()));

#[derive(Debug, Default)]
struct AppState {
    child: Option<tokio::process::Child>,
    last_latency_ms: u64,
}

#[derive(Debug, Serialize)]
struct Status {
    running: bool,
    latency_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Settings {
    ping_host: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            ping_host: "127.0.0.1".to_string(),
        }
    }
}

fn app_dir() -> PathBuf {
    // Prefer Tauri's app config dir when available
    if let Some(dir) = tauri::api::path::config_dir() {
        return dir.join("Nebula Tower Menubar");
    }
    let base = dirs::config_dir().unwrap_or_else(|| std::env::temp_dir());
    base.join("Nebula Tower Menubar")
}

fn default_config_path() -> PathBuf {
    app_dir().join("config.yaml")
}

fn settings_path() -> PathBuf {
    app_dir().join("settings.json")
}

fn load_settings() -> Settings {
    let path = settings_path();
    if let Ok(bytes) = std::fs::read(&path) {
        if let Ok(s) = serde_json::from_slice::<Settings>(&bytes) {
            return s;
        }
    }
    let s = Settings::default();
    let _ = save_settings(&s);
    s
}

fn save_settings(s: &Settings) -> Result<()> {
    std::fs::create_dir_all(app_dir())?;
    let data = serde_json::to_vec_pretty(s)?;
    std::fs::write(settings_path(), data)?;
    Ok(())
}

async fn ensure_nebula() -> Result<PathBuf> {
    // Prefer the app-managed binary first
    let local = app_dir().join("bin").join("nebula");
    if local.exists() {
        debug_log(format!("Using nebula from app bin: {}", local.display()));
        return Ok(local);
    }
    // Fallback to PATH
    if let Ok(path) = which::which("nebula") {
        debug_log(format!("Using nebula from PATH: {}", path.display()));
        return Ok(path);
    }
    Err(anyhow!("nebula binary not found (install via tray or scripts/install_nebula.sh)"))
}

async fn spawn_nebula(settings: &Settings) -> Result<tokio::process::Child> {
    let nebula = ensure_nebula().await?;
    #[cfg(target_os = "macos")]
    {
        let nebula_path = nebula.display().to_string();
        let config_path = default_config_path().display().to_string();
        let shell_cmd = format!("\"{}\" -config \"{}\"", nebula_path, config_path);
        let script = format!(
            "do shell script \"{}\" with administrator privileges",
            shell_cmd.replace("\"", "\\\"")
        );
        let mut cmd = Command::new("/usr/bin/osascript");
        cmd.arg("-e").arg(script);
        cmd.kill_on_drop(true);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        let cwd = app_dir();
        debug_log(format!("Setting working dir to {}", cwd.display()));
        cmd.current_dir(&cwd);
        // Prepend our app bin dir to PATH so any helpers alongside nebula are discoverable
        let bin = app_dir().join("bin");
        let mut path_env = env::var("PATH").unwrap_or_default();
        let bin_s = bin.display().to_string();
        if !path_env.split(':').any(|p| p == bin_s) {
            path_env = format!("{}:{}", bin_s, path_env);
        }
        cmd.env("PATH", path_env);
        let mut child = cmd.spawn().context("failed to spawn nebula with sudo")?;
        // Stream stdout/stderr into our debug log
        if let Some(stdout) = child.stdout.take() {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    debug_log(format!("[nebula stdout] {}", line));
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    debug_log(format!("[nebula stderr] {}", line));
                }
            });
        }
        Ok(child)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let mut cmd = Command::new(nebula);
        cmd.arg("-config").arg(default_config_path());
        cmd.kill_on_drop(true);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        let cwd = app_dir();
        debug_log(format!("Setting working dir to {}", cwd.display()));
        cmd.current_dir(&cwd);
        // Prepend our app bin dir to PATH so any helpers alongside nebula are discoverable
        let bin = app_dir().join("bin");
        let mut path_env = env::var("PATH").unwrap_or_default();
        let bin_s = bin.display().to_string();
        if !path_env.split(':').any(|p| p == bin_s) {
            path_env = format!("{}:{}", bin_s, path_env);
        }
        cmd.env("PATH", path_env);
        let mut child = cmd.spawn().context("failed to spawn nebula")?;
        // Stream stdout/stderr into our debug log
        if let Some(stdout) = child.stdout.take() {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    debug_log(format!("[nebula stdout] {}", line));
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            tauri::async_runtime::spawn(async move {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    debug_log(format!("[nebula stderr] {}", line));
                }
            });
        }
        Ok(child)
    }
}

async fn ping_once(host: &str) -> Result<u64> {
    #[cfg(any(target_os = "macos", target_os = "linux", target_os = "windows"))]
    let arg_count = "-c";

    let out = Command::new("ping")
        .arg(arg_count)
        .arg("1")
        .arg(host)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await?;
    let s = String::from_utf8_lossy(&out.stdout);
    // crude parse for time=XX ms
    let ms = s
        .split_whitespace()
        .find_map(|tok| tok.strip_prefix("time="))
        .and_then(|v| v.split(['m', 's']).next())
        .and_then(|v| v.parse::<f64>().ok())
        .map(|v| v as u64)
        .unwrap_or(0);
    Ok(ms)
}

// Add a helper to check for nebula binary and get its version
fn nebula_bin_path() -> Option<PathBuf> {
    let local = app_dir().join("bin").join("nebula");
    if local.exists() {
        Some(local)
    } else if let Ok(path) = which::which("nebula") {
        Some(path)
    } else {
        None
    }
}

fn nebula_version() -> Option<String> {
    let bin = nebula_bin_path()?;
    let output = std::process::Command::new(bin)
        .arg("-version")
        .output()
        .ok()?;
    if output.status.success() {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !s.is_empty() {
            Some(s)
        } else {
            None
        }
    } else {
        None
    }
}

fn required_files_present(settings: &Settings) -> bool {
    // Check nebula binary
    if nebula_bin_path().is_none() {
        return false;
    }

    // Check config.yaml
    let config_path = default_config_path();
    if !config_path.exists() {
        return false;
    }

    // Check host.key, host.crt, ca.crt in same dir as config
    let config_dir = config_path.parent().unwrap_or(&config_path);
    let host_key = config_dir.join("host.key");
    let host_crt = config_dir.join("host.crt");
    let ca_crt = config_dir.join("ca.crt");
    if !host_key.exists() || !host_crt.exists() || !ca_crt.exists() {
        return false;
    }

    // Check lighthouse IP
    if settings.ping_host.trim().is_empty() {
        return false;
    }

    true
}

// New helper: check only config/certs, not nebula binary
fn config_and_certs_present(settings: &Settings) -> bool {
    // Check config.yaml
    let config_path = default_config_path();
    if !config_path.exists() {
        return false;
    }
    // Check host.key, host.crt, ca.crt in same dir as config
    let config_dir = config_path.parent().unwrap_or(&config_path);
    let host_key = config_dir.join("host.key");
    let host_crt = config_dir.join("host.crt");
    let ca_crt = config_dir.join("ca.crt");
    if !host_key.exists() || !host_crt.exists() || !ca_crt.exists() {
        return false;
    }
    // Check lighthouse IP
    if settings.ping_host.trim().is_empty() {
        return false;
    }
    true
}

#[tauri::command]
async fn check_existing_certs() -> Result<bool, String> {
    let cfg = default_config_path();
    if !cfg.exists() { return Ok(false); }
    let dir = cfg.parent().unwrap_or(&cfg);
    let host_key = dir.join("host.key");
    let host_crt = dir.join("host.crt");
    let ca_crt = dir.join("ca.crt");
    Ok(host_key.exists() || host_crt.exists() || ca_crt.exists())
}

// Redeem an invite by contacting the lighthouse at {ip}/client/api/redeem_invite?invite_code=...
// Response is expected to be a zip file containing certs and config; unzip into app_dir()
#[tauri::command]
async fn redeem_invite(lighthouse_ip: String, invite_code: String, overwrite: bool) -> Result<(), String> {
    let client = Client::builder().timeout(std::time::Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let url = format!("http://{}/client/api/redeem_invite?invite_code={}", lighthouse_ip, invite_code);
    debug_log(format!("Redeeming invite at {}", url));

    let resp = client.get(&url).send().await.map_err(|e| {
        debug_log(format!("Failed to send redeem request: {}", e));
        e.to_string()
    })?;
    let status = resp.status();
    debug_log(format!("Received response with status: {}", status));

    if !status.is_success() {
        debug_log(format!("Redeem request failed with status: {}", status));
        // Try to log the body if possible
        let body_text = resp.text().await;
        match body_text {
            Ok(text) => debug_log(format!("Response body: {}", text)),
            Err(_) => debug_log("Failed to read response body".to_string()),
        }
        return Err(format!("Redeem request failed: {}", status));
    }

    // Read response bytes
    let bytes = resp.bytes().await.map_err(|e| {
        debug_log(format!("Failed to read response bytes: {}", e));
        e.to_string()
    })?;
    debug_log(format!("Successfully read response bytes, size: {}", bytes.len()));

    // Save to a temp file then open as zip
    let mut tmp = NamedTempFile::new().map_err(|e| {
        debug_log(format!("Failed to create temporary file: {}", e));
        e.to_string()
    })?;
    debug_log(format!("Temporary file created at: {}", tmp.path().display()));

    std::io::copy(&mut bytes.as_ref(), &mut tmp).map_err(|e| {
        debug_log(format!("Failed to write response bytes to temporary file: {}", e));
        e.to_string()
    })?;
    debug_log("Response bytes successfully written to temporary file");

    let cursor = Cursor::new(std::fs::read(tmp.path()).map_err(|e| {
        debug_log(format!("Failed to read temporary file: {}", e));
        e.to_string()
    })?);
    debug_log("Temporary file successfully read into cursor");

    let mut zip = ZipArchive::new(cursor).map_err(|e| {
        debug_log(format!("Failed to open ZIP archive: {}", e));
        e.to_string()
    })?;
    debug_log("ZIP archive successfully opened");

    let target_dir = app_dir();
    debug_log(format!("Target directory for extracted files: {}", target_dir.display()));

    std::fs::create_dir_all(&target_dir).map_err(|e| {
        debug_log(format!("Failed to create target directory: {}", e));
        e.to_string()
    })?;
    debug_log("Target directory successfully created");

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match entry.enclosed_name() {
            Some(p) => target_dir.join(p),
            None => continue,
        };

        if entry.name().ends_with('/') {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            continue;
        }

        // Always overwrite existing files during invite redemption
        if outpath.exists() {
            debug_log(format!("Overwriting existing file: {}", outpath.display()));
            // proceed; File::create below will truncate
        }

        if let Some(parent) = outpath.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
    }

    debug_log(format!("Redeem completed and files written to {}", target_dir.display()));
    Ok(())
}

fn tray_menu(running: bool, latency: u64) -> SystemTrayMenu {
    let settings = load_settings();
    let nebula_bin = nebula_bin_path();
    let nebula_ver = nebula_version();
    let config_ok = config_and_certs_present(&settings);

    let mut menu = SystemTrayMenu::new();

    if nebula_bin.is_none() {
        // Nebula binary missing: only show Download, Settings, Quit
        menu = menu
            .add_item(CustomMenuItem::new("download_nebula", "Download Nebula"))
            .add_item(CustomMenuItem::new("settings", "Settings…"))
            .add_item(CustomMenuItem::new("quit", "Quit"));
        return menu;
    }

    // Nebula binary present: show version
    let version_label = match nebula_ver {
        Some(ver) => format!("Nebula: {ver}"),
        None => "Nebula: (version unknown)".to_string(),
    };
    menu = menu.add_item(CustomMenuItem::new("nebula_version", version_label).disabled());

    if !config_ok {
        // Config/certs missing: show disabled Connect button
        menu = menu
            .add_item(CustomMenuItem::new("toggle", "Connect").disabled())
            .add_item(CustomMenuItem::new("settings", "Settings…"))
            .add_item(CustomMenuItem::new("quit", "Quit"));
        return menu;
    }

    // Everything present: normal menu
    let toggle = if running { "Stop" } else { "Start" };
    menu = menu.add_item(CustomMenuItem::new("toggle", toggle));
    menu
        .add_item(CustomMenuItem::new(
            "status",
            format!(
                "Status: {}  |  Ping: {}ms",
                if running { "Running" } else { "Stopped" },
                latency
            ),
        ).disabled())
        .add_item(CustomMenuItem::new("settings", "Settings…"))
        .add_item(CustomMenuItem::new("open_log", "Open Debug Log"))
        .add_item(CustomMenuItem::new("install_nebula", "Install Nebula"))
        .add_item(CustomMenuItem::new("quit", "Quit"))
}

fn debug_log<M: AsRef<str>>(msg: M) {
    let m = msg.as_ref();
    // stdout/stderr (seen in dev console)
    println!("[nebula-tower] {m}");
    let _ = stdout().flush();
    eprintln!("[nebula-tower] {m}");
    let _ = stderr().flush();
    // append to file
    let path = app_dir().join("debug.log");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{m}");
        let _ = f.flush();
    }
}

fn apply_tray<R: Runtime>(app: &tauri::AppHandle<R>) {
    let st = STATE.lock();
    app.tray_handle().set_menu(tray_menu(st.child.is_some(), st.last_latency_ms)).ok();
}

#[tauri::command]
async fn start_nebula<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    let settings = load_settings();
    let already_running = { STATE.lock().child.is_some() };
    if already_running {
        debug_log("Start requested, but nebula is already running");
        return Ok(());
    }
    match spawn_nebula(&settings).await {
        Ok(child) => {
            let pid = child.id().unwrap_or(0);
            {
                let mut st = STATE.lock();
                st.child = Some(child);
            }
            debug_log(format!("Start initiated: spawning nebula with config {:?} (pid={})", default_config_path(), pid));
            apply_tray(&app);
            Ok(())
        }
        Err(e) => {
            debug_log(format!("Start failed: {}", e));
            Err(e.to_string())
        },
    }
}

#[tauri::command]
async fn stop_nebula<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    debug_log("Stop requested");
    let mut maybe_child = { STATE.lock().child.take() };
    if let Some(mut child) = maybe_child.take() {
        let _ = child.kill();
        let _ = child.wait().await;
        debug_log("Nebula stopped");
    }
    apply_tray(&app);
    Ok(())
}

#[tauri::command]
async fn get_status() -> Result<Status, String> {
    let st = STATE.lock();
    Ok(Status { running: st.child.is_some(), latency_ms: st.last_latency_ms })
}

#[tauri::command]
async fn open_settings_window<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    // Try to find an existing window first
    if let Some(w) = app.get_window("settings") {
        // Attempt to show & focus. If successful, done.
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }

    // Otherwise build a new settings window and intercept native close to hide instead of destroy
    let url = tauri::WindowUrl::App("settings.html".into());
    let build = tauri::WindowBuilder::new(&app, "settings", url)
        .title("Settings")
        .min_inner_size(320.0, 220.0)
        .build();

    match build {
        Ok(win) => {
            let win_clone = win.clone();
            win.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win_clone.hide();
                }
            });
            Ok(())
        }
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn save_config(ping_host: String) -> Result<(), String> {
    let mut s = load_settings();
    s.ping_host = ping_host;
    save_settings(&s).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_settings() -> Result<Settings, String> {
    Ok(load_settings())
}

#[tauri::command]
async fn hide_settings<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    if let Some(w) = app.get_window("settings") { let _ = w.hide(); }
    Ok(())
}

#[tauri::command]
async fn install_nebula() -> Result<(), String> {
    // Run the installer script from the project root during dev builds
    let project_root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    let script = project_root.join("scripts").join("install_nebula.sh");
    if !script.exists() {
        return Err(format!("installer script not found at {}", script.display()));
    }
    debug_log(format!("Running installer script: {}", script.display()));
    let out = Command::new("/bin/bash")
        .arg(script)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|e| e.to_string())?;
    debug_log(format!("Installer stdout: {}", String::from_utf8_lossy(&out.stdout)));
    if !out.status.success() {
        debug_log(format!("Installer stderr: {}", String::from_utf8_lossy(&out.stderr)));
        return Err(format!("installer exited with status {}", out.status));
    }
    Ok(())
}

fn build_tray() -> SystemTray { SystemTray::new().with_menu(tray_menu(false, 0)) }

fn main() {
    std::fs::create_dir_all(app_dir()).ok();
    // create an empty default config file if none
    let cfg = default_config_path();
    if !cfg.exists() { let _ = std::fs::write(&cfg, b"# nebula config\n"); }

    tauri::Builder::default()
        .system_tray(build_tray())
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "toggle" => {
                    // Only allow toggle if nebula binary and config/certs are present
                    let settings = load_settings();
                    if nebula_bin_path().is_none() || !config_and_certs_present(&settings) {
                        // Do nothing if not available
                        return;
                    }
                    let app = app.clone();
                    let was_running = STATE.lock().child.is_some();
                    if was_running {
                        debug_log("Tray toggle clicked: stopping nebula");
                    } else {
                        debug_log("Tray toggle clicked: starting nebula");
                    }
                    tauri::async_runtime::spawn(async move {
                        let running = STATE.lock().child.is_some();
                        if running { let _ = stop_nebula(app.clone()).await; } else { let _ = start_nebula(app.clone()).await; }
                        apply_tray(&app);
                        let now_running = STATE.lock().child.is_some();
                        debug_log(format!("Toggle action completed. Running now: {}", now_running));
                    });
                }
                "download_nebula" => {
                    // Open the install script or download page
                    debug_log("Tray clicked: Download Nebula");
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = install_nebula().await {
                            debug_log(format!("Download nebula failed: {}", e));
                        } else {
                            debug_log("Download nebula completed successfully");
                        }
                    });
                }
                "settings" => {
                    // Use the open_settings_window helper so we always create or show and
                    // attach the CloseRequested handler. Run async to avoid doing this on the tray thread.
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = open_settings_window(app).await;
                    });
                }
                "open_log" => {
                    let path = app_dir().join("debug.log");
                    debug_log(format!("Opening debug log at {:?}", path));
                    // Try to open the log file with the user's default text editor using std::process::Command as a fallback
                    #[cfg(target_os = "macos")]
                    {
                        use std::process::Command;
                        let _ = Command::new("open")
                            .arg(&path)
                            .spawn();
                    }
                    #[cfg(target_os = "linux")]
                    {
                        use std::process::Command;
                        let _ = Command::new("xdg-open")
                            .arg(&path)
                            .spawn();
                    }
                    #[cfg(target_os = "windows")]
                    {
                        use std::process::Command;
                        let _ = Command::new("cmd")
                            .args(&["/C", "start", "", &path.to_string_lossy()])
                            .spawn();
                    }
                }
                "install_nebula" => {
                    debug_log("Tray clicked: Install Nebula");
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = install_nebula().await {
                            debug_log(format!("Install nebula failed: {}", e));
                        } else {
                            debug_log("Install nebula completed successfully");
                        }
                    });
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            // periodic ping updater
            let handle = app.handle();
            tauri::async_runtime::spawn(async move {
                loop {
                    // Only ping if nebula is running
                    let is_running = { STATE.lock().child.is_some() };
                    let ms = if is_running {
                        let host = load_settings().ping_host;
                        ping_once(&host).await.unwrap_or(0)
                    } else {
                        0
                    };
                    {
                        let mut st = STATE.lock();
                        st.last_latency_ms = ms;
                    }
                    apply_tray(&handle);
                    time::sleep(Duration::from_secs(5)).await;
                }
            });

            // monitor nebula process and detect unexpected exit
            let handle2 = app.handle();
            tauri::async_runtime::spawn(async move {
                loop {
                    let exited = {
                        let mut st = STATE.lock();
                        if let Some(child) = st.child.as_mut() {
                            match child.try_wait() {
                                Ok(Some(status)) => {
                                    st.child.take();
                                    Some(status)
                                }
                                Ok(None) => None,
                                Err(e) => {
                                    debug_log(format!("Error checking nebula status: {}", e));
                                    None
                                }
                            }
                        } else {
                            None
                        }
                    };
                    if let Some(status) = exited {
                        debug_log(format!("Nebula exited unexpectedly: {:?}", status));
                        apply_tray(&handle2);
                    }
                    time::sleep(Duration::from_secs(2)).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_nebula, stop_nebula, get_status, open_settings_window,
            save_config, get_settings, hide_settings, install_nebula
            , redeem_invite, check_existing_certs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
