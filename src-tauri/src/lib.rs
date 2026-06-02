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

// 辅助方法：生成带有通用浏览器 User-Agent 的 HTTP 客户端以避免被拦截
fn get_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 1. 整句翻译后端代理命令 (支持谷歌、有道、百度三种公开免签划词接口切换)
#[tauri::command]
async fn translate_sentence_backend(sentence: String, provider: String) -> Result<String, String> {
    let client = get_http_client()?;
    
    if provider == "youdao" {
        // 有道翻译网页公开免签接口
        let response = client
            .get("https://fanyi.youdao.com/translate")
            .query(&[("doctype", "json"), ("type", "AUTO"), ("i", sentence.as_str())])
            .send()
            .await
            .map_err(|e| format!("有道网络请求发送失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("有道接口响应状态错误: {}", response.status()));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析有道响应JSON失败: {}", e))?;

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
        Err("有道未返回有效的翻译结果".to_string())
    } else if provider == "baidu" {
        // 百度翻译网页公开免签划词接口
        let response = client
            .get("https://fanyi.baidu.com/transapi")
            .query(&[
                ("from", "auto"),
                ("to", "zh"),
                ("query", sentence.as_str()),
            ])
            .send()
            .await
            .map_err(|e| format!("百度网络请求发送失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("百度接口响应状态错误: {}", response.status()));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析百度响应JSON失败: {}", e))?;

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
        Err("百度未返回有效的翻译结果".to_string())
    } else {
        // 默认采用谷歌免签高稳定划词接口
        let response = client
            .get("https://translate.googleapis.com/translate_a/single")
            .query(&[
                ("client", "gtx"),
                ("sl", "auto"),
                ("tl", "zh-CN"),
                ("dt", "t"),
                ("q", sentence.as_str()),
            ])
            .send()
            .await
            .map_err(|e| format!("谷歌网络请求发送失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("谷歌接口响应状态错误: {}", response.status()));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析谷歌响应JSON失败: {}", e))?;

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
        Err("谷歌未获取到有效的翻译结果".to_string())
    }
}


// 2. 单词释义与音标后端代理命令 (整合了联想和音标接口)
#[tauri::command]
async fn get_word_detail_backend(word: String) -> Result<serde_json::Value, String> {
    let client = get_http_client()?;
    
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
    match get_http_client() {
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
async fn get_online_audio_backend(text: String, accent: String, provider: String) -> Result<String, String> {
    let client = get_http_client()?;
    
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            translate_sentence_backend,
            get_word_detail_backend,
            get_phonetic_from_dict_backend,
            get_online_audio_backend
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

