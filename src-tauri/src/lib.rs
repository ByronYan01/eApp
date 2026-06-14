use serde::{Deserialize, Serialize};



// 声明单词 suggestion API 响应的数据结构
#[derive(Debug, Deserialize, Serialize)]
struct SuggestEntry {
    explain: String,
    entry: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct SuggestData {
    entries: Option<Vec<SuggestEntry>>,
}

#[derive(Debug, Deserialize, Serialize)]
struct YoudaoSuggestResponse {
    data: Option<SuggestData>,
}

// 声明词典详细接口响应的数据结构
#[derive(Debug, Deserialize, Serialize)]
struct EcWord {
    usphone: Option<String>,
    ukphone: Option<String>,
    phone: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct EcData {
    word: Option<Vec<EcWord>>,
}

#[derive(Debug, Deserialize, Serialize)]
struct YoudaoJsonapiResponse {
    ec: Option<EcData>,
}

// 辅助方法：生成带有通用浏览器 User-Agent 的 HTTP 客户端以避免被拦截，支持传入超时时间 (毫秒)
fn get_http_client(timeout_ms: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 谷歌翻译公开免签接口请求辅助函数
async fn translate_by_google(client: &reqwest::Client, sentence: &str) -> Result<String, String> {
    let response = client
        .get("https://translate.googleapis.com/translate_a/single")
        .query(&[
            ("client", "gtx"),
            ("sl", "auto"),
            ("tl", "zh-CN"),
            ("dt", "t"),
            ("q", sentence),
        ])
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("接口响应状态错误: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;

    if let Some(outer_list) = data.as_array() {
        if let Some(sentences_list) = outer_list.first().and_then(|v| v.as_array()) {
            let mut translated_parts = Vec::new();
            for item in sentences_list {
                if let Some(translated_text) = item.as_array().and_then(|arr| arr.first()).and_then(|v| v.as_str()) {
                    translated_parts.push(translated_text.to_string());
                }
            }
            if !translated_parts.is_empty() {
                return Ok(translated_parts.join(""));
            }
        }
    }
    Err("未获取到有效的翻译文本".to_string())
}

// 有道翻译公开免签接口请求辅助函数
async fn translate_by_youdao(client: &reqwest::Client, sentence: &str) -> Result<String, String> {
    let response = client
        .get("https://fanyi.youdao.com/translate")
        .query(&[("doctype", "json"), ("type", "AUTO"), ("i", sentence)])
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("接口响应状态错误: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;

    if let Some(outer_list) = data.get("translateResult").and_then(|v| v.as_array()) {
        if let Some(inner_list) = outer_list.first().and_then(|v| v.as_array()) {
            let mut translated_parts = Vec::new();
            for item in inner_list {
                if let Some(tgt) = item.get("tgt").and_then(|v| v.as_str()) {
                    translated_parts.push(tgt.to_string());
                }
            }
            if !translated_parts.is_empty() {
                return Ok(translated_parts.join(""));
            }
        }
    }
    Err("未返回有效的翻译文本".to_string())
}

// 百度翻译公开免签划词接口请求辅助函数
async fn translate_by_baidu(client: &reqwest::Client, sentence: &str) -> Result<String, String> {
    let response = client
        .get("https://fanyi.baidu.com/transapi")
        .query(&[
            ("from", "auto"),
            ("to", "zh"),
            ("query", sentence),
        ])
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("接口响应状态错误: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;

    if let Some(data_list) = data.get("data").and_then(|v| v.as_array()) {
        let mut translated_parts = Vec::new();
        for item in data_list {
            if let Some(dst) = item.get("dst").and_then(|v| v.as_str()) {
                translated_parts.push(dst.to_string());
            }
        }
        if !translated_parts.is_empty() {
            return Ok(translated_parts.join(""));
        }
    }
    Err("未返回有效的翻译文本".to_string())
}

// MyMemory 翻译接口请求辅助函数
async fn translate_by_mymemory(client: &reqwest::Client, sentence: &str) -> Result<String, String> {
    let response = client
        .get("https://api.mymemory.translated.net/get")
        .query(&[
            ("q", sentence),
            ("langpair", "en|zh"),
        ])
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("接口响应状态错误: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 JSON 失败: {}", e))?;

    if let Some(res_data) = data.get("responseData") {
        if let Some(translated_text) = res_data.get("translatedText").and_then(|v| v.as_str()) {
            return Ok(translated_text.to_string());
        }
    }
    
    Err("未获取到有效的翻译文本".to_string())
}

// 1. 整句翻译后端代理命令 (支持谷歌、有道、百度、mymemory 四种公开免签划词接口切换与级联防超时兜底)
#[tauri::command]
async fn translate_sentence_backend(sentence: String, provider: String, timeout_ms: Option<u64>) -> Result<String, String> {
    let timeout = timeout_ms.unwrap_or(5000);
    let client = get_http_client(timeout)?;
    
    // 动态编排翻译引擎的尝试顺序。用户指定的引擎首选使用，其余引擎依序兜底。
    let mut order = vec!["mymemory", "youdao", "baidu", "google"];
    if provider == "google" {
        order = vec!["google", "mymemory", "youdao", "baidu"];
    } else if provider == "baidu" {
        order = vec!["baidu", "mymemory", "youdao", "google"];
    } else if provider == "youdao" {
        order = vec!["youdao", "mymemory", "baidu", "google"];
    } else if provider == "mymemory" {
        order = vec!["mymemory", "youdao", "baidu", "google"];
    } else if provider == "auto" {
        order = vec!["mymemory", "youdao", "baidu", "google"]; // 智能兜底默认先试最稳的 MyMemory
    }
    
    let mut errors = Vec::new();
    
    for engine in order {
        let result = match engine {
            "google" => translate_by_google(&client, &sentence).await,
            "youdao" => translate_by_youdao(&client, &sentence).await,
            "baidu" => translate_by_baidu(&client, &sentence).await,
            "mymemory" => translate_by_mymemory(&client, &sentence).await,
            _ => Err("未知引擎".to_string()),
        };
        
        match result {
            Ok(trans) => return Ok(trans),
            Err(e) => {
                errors.push(format!("{}: {}", engine, e));
            }
        }
    }
    
    Err(format!("未能从任何翻译 API 获取到翻译数据，请检查网络连接。详情：\n{}", errors.join("\n")))
}


// 2. 单词释义与音标后端代理命令 (整合了联想和音标接口)
#[tauri::command]
async fn get_word_detail_backend(word: String) -> Result<serde_json::Value, String> {
    let client = get_http_client(5000)?;
    
    let response = client
        .get("https://dict.youdao.com/suggest")
        .query(&[("q", word.as_str()), ("num", "1"), ("doctype", "json")])
        .send()
        .await
        .map_err(|e| format!("网络请求发送失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("接口响应状态错误: {}", response.status()));
    }

    let data: YoudaoSuggestResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应JSON失败: {}", e))?;

    // 获取完整的英、美、通用音标数据
    let (us_phonetic, uk_phonetic, phone_phonetic) = get_all_phonetics_backend(word.clone()).await;

    if let Some(data_field) = data.data {
        if let Some(entries) = data_field.entries {
            if let Some(entry) = entries.first() {
                let explain = entry.explain.replace("\\n", " ");
                
                return Ok(serde_json::json!({
                    "us_phonetic": us_phonetic,
                    "uk_phonetic": uk_phonetic,
                    "phone_phonetic": phone_phonetic,
                    "explain": explain
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "us_phonetic": "",
        "uk_phonetic": "",
        "phone_phonetic": "",
        "explain": "暂无单词释义"
    }))
}

// 辅助方法：获取单词的所有音标类型（美音、英音、通用音标）
async fn get_all_phonetics_backend(word: String) -> (String, String, String) {
    match get_http_client(5000) {
        Ok(client) => {
            let response = client
                .get("https://dict.youdao.com/jsonapi")
                .query(&[("q", word.as_str())])
                .send()
                .await;

            if let Ok(resp) = response {
                if resp.status().is_success() {
                    if let Ok(data) = resp.json::<YoudaoJsonapiResponse>().await {
                        if let Some(ec) = data.ec {
                            if let Some(words) = ec.word {
                                if let Some(w) = words.first() {
                                    return (
                                        w.usphone.clone().unwrap_or_default(),
                                        w.ukphone.clone().unwrap_or_default(),
                                        w.phone.clone().unwrap_or_default(),
                                    );
                                }
                            }
                        }
                    }
                }
            }
            ("".to_string(), "".to_string(), "".to_string())
        }
        Err(_) => ("".to_string(), "".to_string(), "".to_string()),
    }
}

// 3. 详细单词音标获取后端代理命令 (保留对旧API的兼顾与对外暴露)
#[tauri::command]
async fn get_phonetic_from_dict_backend(word: String) -> Result<String, String> {
    let phonetics = get_all_phonetics_backend(word).await;
    let us = phonetics.0;
    let uk = phonetics.1;
    let phone = phonetics.2;
    
    let result = if !us.is_empty() {
        us
    } else if !uk.is_empty() {
        uk
    } else {
        phone
    };
    
    Ok(result)
}

// 4. 多级级联在线真人原声 TTS 代理命令 (支持有道、谷歌、百度发音的动态主次切换与无缝故障兜底)
#[tauri::command]
async fn get_online_audio_backend(text: String, accent: String, provider: String, timeout_ms: Option<u64>) -> Result<String, String> {
    let timeout = timeout_ms.unwrap_or(5000);
    let client = get_http_client(timeout)?;
    
    // 首选口音类型，有道 2 为美音，1 为英音
    let youdao_type = if accent == "US" { "2" } else { "1" };
    
    let mut audio_bytes = None;
    
    // 动态编排引擎级联检索顺序。用户指定的引擎会首选使用，其余引擎依序兜底。
    let mut order = vec!["youdao", "google", "baidu"];
    if provider == "google" {
        order = vec!["google", "youdao", "baidu"];
    } else if provider == "baidu" {
        order = vec!["baidu", "youdao", "google"];
    } else if provider == "youdao" {
        order = vec!["youdao", "google", "baidu"];
    }
    
    for engine in order {
        if engine == "youdao" {
            let youdao_url = "https://dict.youdao.com/dictvoice";
            if let Ok(resp) = client.get(youdao_url)
                .query(&[("audio", text.as_str()), ("type", youdao_type)])
                .send()
                .await 
            {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        // 确保获取的字节数不是极小的拦截页面 (有道正常音频通常大于 300 字节)
                        if bytes.len() > 300 {
                            audio_bytes = Some(bytes);
                            break;
                        }
                    }
                }
            }
        } else if engine == "google" {
            let google_lang = if accent == "US" { "en" } else { "en-gb" };
            let google_url = "https://translate.google.com/translate_tts";
            if let Ok(resp) = client.get(google_url)
                .query(&[
                    ("ie", "UTF-8"),
                    ("q", text.as_str()),
                    ("tl", google_lang),
                    ("client", "tw-ob"),
                ])
                .send()
                .await 
            {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        if bytes.len() > 300 {
                            audio_bytes = Some(bytes);
                            break;
                        }
                    }
                }
            }
        } else if engine == "baidu" {
            let baidu_url = "https://tts.baidu.com/text2audio";
            if let Ok(resp) = client.get(baidu_url)
                .query(&[
                    ("tex", text.as_str()),
                    ("lan", "en"),
                    ("spd", "5"),
                    ("xml", "0"),
                ])
                .send()
                .await 
            {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        if bytes.len() > 300 {
                            audio_bytes = Some(bytes);
                            break;
                        }
                    }
                }
            }
        }
    }
    
    if let Some(bytes) = audio_bytes {
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let b64 = STANDARD.encode(&bytes);
        return Ok(format!("data:audio/mp3;base64,{}", b64));
    }
    
    Err("未能从任何真人发音 API 获取到音频数据，请检查您的网络连接。".to_string())
}

// 辅助方法：生成用于 GitHub API 请求的 Client
fn get_github_client(token: &str) -> Result<reqwest::Client, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    
    let mut auth_val = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token))
        .map_err(|e| format!("Token 格式错误: {}", e))?;
    auth_val.set_sensitive(true);
    headers.insert(reqwest::header::AUTHORIZATION, auth_val);
    
    let accept_val = reqwest::header::HeaderValue::from_static("application/vnd.github+json");
    headers.insert(reqwest::header::ACCEPT, accept_val);
    
    let api_version_val = reqwest::header::HeaderValue::from_static("2022-11-28");
    headers.insert(reqwest::header::HeaderName::from_static("x-github-api-version"), api_version_val);

    reqwest::Client::builder()
        .user_agent("eApp-Client")
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(10)) // 同步超时设定为 10 秒
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn github_create_gist_backend(token: String, data: String) -> Result<String, String> {
    let client = get_github_client(&token)?;
    
    let body = serde_json::json!({
        "description": "eApp English Sync Data",
        "public": false,
        "files": {
            "eapp_sync_data.json": {
                "content": data
            }
        }
    });

    let response = client
        .post("https://api.github.com/gists")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求发送失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("创建 Gist 失败，GitHub 返回错误 ({}): {}", status, err_text));
    }

    let json_resp: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 GitHub 响应 JSON 失败: {}", e))?;

    if let Some(gist_id) = json_resp.get("id").and_then(|v| v.as_str()) {
        return Ok(gist_id.to_string());
    }

    Err("未从 GitHub 响应中找到有效的 Gist ID".to_string())
}

#[tauri::command]
async fn github_read_gist_backend(token: String, gist_id: String) -> Result<String, String> {
    let client = get_github_client(&token)?;
    
    let url = format!("https://api.github.com/gists/{}", gist_id);
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("网络请求发送失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("读取 Gist 失败，GitHub 返回错误 ({}): {}", status, err_text));
    }

    let json_resp: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 GitHub 响应 JSON 失败: {}", e))?;

    if let Some(files) = json_resp.get("files") {
        if let Some(file_obj) = files.get("eapp_sync_data.json") {
            if let Some(content) = file_obj.get("content").and_then(|v| v.as_str()) {
                return Ok(content.to_string());
            }
        }
    }

    Err("未在绑定的 Gist 中找到名为 eapp_sync_data.json 的备份文件。如果您是首次在另一台电脑使用，可点击强制推送以初始化该文件。".to_string())
}

#[tauri::command]
async fn github_write_gist_backend(token: String, gist_id: String, data: String) -> Result<String, String> {
    let client = get_github_client(&token)?;
    
    let url = format!("https://api.github.com/gists/{}", gist_id);
    
    let body = serde_json::json!({
        "description": "eApp English Sync Data (Updated)",
        "files": {
            "eapp_sync_data.json": {
                "content": data
            }
        }
    });

    let response = client
        .patch(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求发送失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("写入 Gist 失败，GitHub 返回错误 ({}): {}", status, err_text));
    }

    Ok("数据已成功推送到云端！".to_string())
}

#[tauri::command]
async fn call_private_ai(
    endpoint: String,
    api_key: String,
    model: String,
    prompt: String,
    system_prompt: Option<String>,
) -> Result<String, String> {
    // 60秒超时，因为大模型生成可能较慢
    let client = get_http_client(60000)?;
    
    // 拼接请求 URL
    let mut url = endpoint.trim().to_string();
    if !url.ends_with("/chat/completions") {
        if url.ends_with('/') {
            url.push_str("chat/completions");
        } else {
            url.push_str("/chat/completions");
        }
    }

    let mut messages = Vec::new();
    if let Some(sys) = system_prompt {
        if !sys.is_empty() {
            messages.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.3
    });

    let mut req = client.post(&url);
    if !api_key.is_empty() {
        req = req.bearer_auth(&api_key);
    }

    let response = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求发送失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("AI 接口返回错误 ({}): {}", status, err_text));
    }

    let json_resp: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 AI 响应 JSON 失败: {}", e))?;

    if let Some(choices) = json_resp.get("choices").and_then(|v| v.as_array()) {
        if let Some(first_choice) = choices.first() {
            if let Some(message) = first_choice.get("message") {
                if let Some(content) = message.get("content").and_then(|v| v.as_str()) {
                    return Ok(content.to_string());
                }
            }
        }
    }

    Err("未从 AI 响应中找到有效的内容 (choices.message.content 缺失)".to_string())
}

#[tauri::command]
async fn call_private_ai_stream(
    endpoint: String,
    api_key: String,
    model: String,
    prompt: String,
    system_prompt: Option<String>,
    on_event: tauri::ipc::Channel<String>,
) -> Result<(), String> {
    use futures_util::StreamExt;

    // 60秒超时，防止大模型生成过慢
    let client = get_http_client(60000)?;
    
    // 拼接请求 URL
    let mut url = endpoint.trim().to_string();
    if !url.ends_with("/chat/completions") {
        if url.ends_with('/') {
            url.push_str("chat/completions");
        } else {
            url.push_str("/chat/completions");
        }
    }

    let mut messages = Vec::new();
    if let Some(sys) = system_prompt {
        if !sys.is_empty() {
            messages.push(serde_json::json!({
                "role": "system",
                "content": sys
            }));
        }
    }
    messages.push(serde_json::json!({
        "role": "user",
        "content": prompt
    }));

    // 开启流式响应
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "stream": true
    });

    let mut req = client.post(&url);
    if !api_key.is_empty() {
        req = req.bearer_auth(&api_key);
    }

    let response = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("网络请求发送失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        return Err(format!("AI 接口返回错误 ({}): {}", status, err_text));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    // 逐字节块读取流，拼接并按换行符拆分完整行
    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|e| format!("读取流式数据失败: {}", e))?;
        let chunk_str = String::from_utf8_lossy(&bytes);
        buffer.push_str(&chunk_str);

        while let Some(newline_idx) = buffer.find('\n') {
            let line = buffer[..newline_idx].trim().to_string();
            buffer = buffer[newline_idx + 1..].to_string();

            if line.starts_with("data: ") {
                let data_str = line[6..].trim();
                if data_str == "[DONE]" {
                    break;
                }
                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(data_str) {
                    if let Some(choices) = json_val.get("choices").and_then(|v| v.as_array()) {
                        if let Some(first_choice) = choices.first() {
                            if let Some(delta) = first_choice.get("delta") {
                                let delta_str = delta.to_string();
                                // 通过 tauri Channel 向前端推送这一帧 delta
                                on_event.send(delta_str).map_err(|e| format!("通道推送失败: {}", e))?;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            translate_sentence_backend,
            get_word_detail_backend,
            get_phonetic_from_dict_backend,
            get_online_audio_backend,
            github_create_gist_backend,
            github_read_gist_backend,
            github_write_gist_backend,
            call_private_ai,
            call_private_ai_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

