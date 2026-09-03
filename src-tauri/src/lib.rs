mod ai;
mod asr;
mod audio;
mod effects;
mod media;
mod secrets;
mod speech;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(asr::AsrManagerState::default())
        .manage(ai::AiRequestState::default())
        .manage(media::ExportManagerState::default())
        .manage(speech::SpeechRequestState::default())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|_app| {
            // Windows 使用自绘窗口控制按钮，去掉原生装饰。
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;

                let window = _app
                    .get_webview_window("main")
                    .expect("main window should be available");
                window.set_decorations(false)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            toggle_devtools,
            ai::save_ai_api_key,
            ai::has_ai_api_key,
            ai::invoke_ai_provider,
            ai::list_ai_models,
            ai::cancel_ai_request,
            media::media_tool_status,
            media::probe_media,
            media::generate_media_derivatives,
            media::generate_proxy_media,
            media::extract_media_audio,
            media::export_render_plan,
            media::cancel_export_job,
            media::save_project_file,
            media::read_project_file,
            media::media_path_exists,
            asr::asr_runtime_status,
            asr::asr_model_catalog,
            asr::download_asr_model,
            asr::install_asr_runtime,
            asr::cancel_asr_job,
            asr::remove_asr_model,
            asr::transcribe_media,
            audio::save_recording,
            audio::list_system_voices,
            audio::synthesize_speech,
            speech::save_speech_api_key,
            speech::has_speech_api_key,
            speech::verify_cloud_speech,
            speech::synthesize_cloud_speech,
            speech::merge_cloud_speech_segments,
            speech::transcribe_cloud_media,
            speech::cancel_cloud_speech_request,
            effects::inspect_effect_package,
            effects::list_effect_packages,
            effects::install_effect_package,
            effects::uninstall_effect_package
        ])
        .run(tauri::generate_context!())
        .expect("error while running BVideo Studio");
}

// 开发模式下打开/关闭调试控制台（DevTools）。
// 仅 debug 构建下生效；release 构建调用为空操作，不会编译进 DevTools 功能。
// 前端通过 invoke("toggle-devtools") 触发，快捷键绑定见 src/App.tsx。
#[tauri::command(name = "toggle-devtools")]
fn toggle_devtools(_webview: tauri::Webview) {
    #[cfg(debug_assertions)]
    {
        let was_open = _webview.is_devtools_open();
        eprintln!("[devtools] toggle invoked, was_open={was_open}");
        if was_open {
            _webview.close_devtools();
        } else {
            _webview.open_devtools();
        }
        eprintln!(
            "[devtools] after toggle, is_open={}",
            _webview.is_devtools_open()
        );
    }
}
