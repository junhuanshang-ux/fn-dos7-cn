use serde::Deserialize;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[derive(Deserialize)]
struct AppConfig {
    name: String,
    url: String,
    width: f64,
    height: f64,
    #[serde(default)]
    inject_js: String,
}

// 配置在编译期被烘焙进可执行文件，产物自包含、不依赖外部文件
const APP_CONFIG: &str = include_str!("../app.config.json");

// 入口放在 lib 里：Tauri 的移动端（Android/iOS）要求 crate 提供 library target。
// mobile_entry_point 宏是移动端必需项，缺少它打包时会被判定为"无有效运行时符号"。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg: AppConfig = serde_json::from_str(APP_CONFIG).expect("app.config.json 解析失败");
    let url: tauri::Url = cfg.url.parse().expect("启动地址不合法");

    tauri::Builder::default()
        .setup(move |app| {
            let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title(&cfg.name)
                .inner_size(cfg.width, cfg.height);

            // 注入脚本在每次页面加载前执行：适合去广告、改样式、自动化
            if !cfg.inject_js.trim().is_empty() {
                builder = builder.initialization_script(cfg.inject_js.as_str());
            }

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}
