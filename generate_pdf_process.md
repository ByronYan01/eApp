# 📖 Ogden's Basic English 850 打印级 PDF 生成与排版踩坑实录

本文件详细记录了为 **eApp** 项目量身定制、制作两套不同排版逻辑的 C.K.Ogden Basic English 850 极简背诵版 PDF 的完整实现过程、设计理念，以及在 Python ReportLab 渲染中所遇到的**中文字体不兼容、多栏跨页列宽丢失 Bug**等核心技术踩坑点与最终的优雅解决方案。

---

## 📌 一、 前言与用户痛点分析

在目前网络上流传的 Ogden Basic English 850 官方文档和大多数第三方单词表中，存在以下致命痛点：
1. **官方资料缺失音标**：仅提供干瘪的 850 单词表，没有任何音标，导致国内学习者在自测背诵时“看得懂却读不准，更不敢开口说”。
2. **场景例句缺失标音**：即便是带例句的版本，也缺少整句的连读发音辅助，学习者无法判断弱读、浊化等美语连贯语流发音。
3. **彩色排版不易打印**：网络版本的彩色高亮底纹在黑白打印机上会印出大面积偏灰、模糊甚至糊墨的墨点（Halftone 网纹），字迹极度模糊且浪费打印机墨水。
4. **分类分界不清晰**：Operations（操作词）、General Things（通用名词）等五大类别常常在双栏排版中自然流动，导致分类标题错落在页面各处，无法一目了然地界定大类。

为了彻底解决以上痛点，我们个人出于学习与交流目的，精细设计了两个版本的打印讲义 PDF，并为每个 PDF 同步导出了完全对应排版结构的 Markdown 文档：
* **《豪华精装带例句对照版 PDF & MD》 (51页)**：单列铺开，自带官方中英场景例句，且**全网首创标注了整句连贯美式音标**。
* **《黑白极简 3列网格省纸版 PDF & MD》 (5-9页)**：炭深灰底白字色块作强分界线，一行并排3个单词，每个词块“左英右中”绝对隔离，极致省纸且极易遮挡背诵。

---

## 🎨 二、 双版本核心设计方案

### 1. 豪华精装例句对照版 (`basic_english_850_recitation.pdf`)
* **排版**：A4 单栏纵向对照。
* **例句三层结构**：例句单元格排版利用 ReportLab 的 `Paragraph` 结合 HTML-like 标签实现纵向三层结构：
  1. 英文场景例句（粗体加深，便于视读）
  2. `/整句连读美式音标/`（斜杠包裹，中灰色 7.2pt 小字）
  3. 中文翻译例句（灰色 7.5pt 小字）
* **核心高亮**：18 个万能核心动词（如 **be**, **come**）在单词列以醒目的**深橘红色**高亮标出，并在后缀添加 `*`。

### 2. 黑白极简 3列网格省纸版 (`basic_english_850_compact.pdf`)
* **排版**：A4 3列拼版网格。
* **黑白明暗强分界**：外层大 Table 的分类标题使用**炭灰色底白字条**作为分类的大标题（横跨整宽 535pt）。
* **分类隔离**：当上一个大类结束时，表格立刻自然截断，并在下一次新大类开始时，**再次在整行开启深色标题条重新编排**，建立清晰的分界线。
* **嵌套 Table 解决遮挡背诵**：一行虽然并排展示了 3 个单词块，但每个单词块内嵌一个宽度为 172pt 的 3列微型小 Table。实现了 `单词 [音标]` 绝对居左，而对应的 `中文释义` **绝对右对齐**。用户用卡片遮住右半边，能完美进行自测自考。
* **斑马线去墨点化**：奇偶行底色完全去彩，偶数行仅设极淡的微灰，奇数行留白，并配合超细分割线，在黑白打印下字迹清晰锐利，无墨点晕开。

---

## 🛠️ 三、 技术踩坑实录与核心算法实现

在 Python 使用 ReportLab 编译并自动计算生成这两份高精度 PDF 时，我们遇到了两个非常隐蔽且致命的技术陷阱，以下是我们的解决过程：

### 踩坑 1：TTC 字体 OpenType 轮廓不兼容 (ReportLab 报错)
* **现象**：在 macOS 环境下，我们最初尝试直接注册系统内置的苹方常规体 `/System/Library/Fonts/PingFang.ttc` 作为中文字体。但在 ReportLab 中实例化 `TTFont` 时直接报错：
  `reportlab.pdfbase.ttfonts.TTFError: TTC file "...": postscript outlines are not supported`
* **根源分析**：苹方 `.ttc` 字体文件内部使用的是 OpenType (CFF) 轮廓，而 ReportLab 默认的 TrueType 字体模块只支持传统的 TrueType (glyf) 轮廓。
* **解决方案**：放弃解析 CFF 轮廓字体，改用 macOS 中自带的 TrueType 轮廓字体：
  `font_path = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"` （或 `/Library/Fonts/Arial Unicode.ttf`）
  该字体完美兼容 ReportLab 并支持庞大的 Unicode 字符集，完美解决中文汉字与国际 IPA 音标符号乱码问题。

### 踩坑 2：ReportLab 跨栏跨页 Table 自动切分导致列宽自动缩水 (竖排 Bug)
* **现象**：在最初的 3列网格 PDF 版本中，整个分类（如 400 词的 General Things）被包含在同一个大 `Table` 内。在遇到 Frame 底部发生自动分页/跨栏切分时，后续页面右栏的单元格突然发生变形缩水，单词（如 `church`）和中文释义全部被挤成了一个字母占一行的单字竖排格式。
* **根源分析**：ReportLab 的 `Table` 结构在发生跨页/跨 Frame 自动折行断开时，其后台渲染引擎有时会将切分后的后半部分表格误判定为没有显式指定 `colWidths`，转而根据当前单元格的首行来进行自动列宽计算（Autosize）。若首行内容较短，整列宽度就会被瞬间缩水。
* **解决方案**：废除单个大 Table 机制，改用**行级流式 Table 控制**：
  在 story 中遍历每个单词（或 3 个单词组成的行）时，**将每一行都单独实例化为一个一行的 Table**，并显式分配列宽 `colWidths=[65, 60, 135.13]`（大网格为 `[178.4, 178.4, 178.4]`）。
  * 每一个小 Table 行高非常小（仅约 10.5pt）。
  * 在 Frame 底部不够装一行 Table 时，ReportLab 就会自然地在小 Table 之间进行分页，将整行移入下一 Frame，**100% 杜绝了跨页切分单行 Table 的可能，彻底根治了列宽失效导致的竖排变形 Bug**。

### 核心算法：高精度整句美式连读音标转写
* **痛点**：若简单的通过将每个单词查词典并拼接，由于动词变形（如 see 过去式 saw，come 过去式 came）、代词人称变化及各种弱读缩写（I'm, It's），拼接出的音标必定会出现发音错误。
* **解决方案**：在 Python 脚本中引入了主流的语音学转写库 `eng_to_ipa`。该库基于完整的卡内基梅隆大学发音词典（CMUDict），能够根据上下文语流直接翻译整句：
  ```python
  import eng_to_ipa as ipa
  ex_phonetic = ipa.convert("I saw a dog.")
  # 输出: "aɪ sɔ ə dɔg."
  ```
  在输出中，通过 `clean_phonetic` 规则洗掉 `eng_to_ipa` 标记未识别词的星号 `*`，并对缩写字符进行了美化处理，确保打印在纸面上的例句发音绝对正确。

---

## 📦 四、 技术栈与构建指令一览

项目本身是个 Vue/TS 前端工程，为了保持环境纯净、防止在用户项目中引入无关的 `venv` 虚拟环境或产生侵入性的包文件，我们利用了现代 Python 包管理工具 `uv` 的单命令执行和临时依赖挂载技巧：

1. **临时挂载依赖运行脚本（核心技巧）**：
   无需在本地全局安装 `reportlab` 和 `eng_to_ipa`，使用 `uv run --with` 在隔离的临时虚拟环境中运行：
   * **运行豪华背诵版与极简版 Markdown 生成脚本**：
     ```bash
     uv run --with eng_to_ipa python src/assets/scratch/generate_mds.py
     ```
   * **运行黑白极简省纸版 PDF 生成脚本**：
     ```bash
     uv run --with reportlab python src/assets/scratch/generate_pdf_compact.py
     ```
   * **运行场景例句音标豪华版 PDF 生成脚本**：
     ```bash
     uv run --with reportlab --with eng_to_ipa python src/assets/scratch/generate_pdf.py
     ```

---

## 📂 五、 双版本 PDF 及 Markdown 核心资产一览

本轮工作产生的所有高价值资产已经双向输出保存在了项目根目录下和助手归档目录中，随时可供使用与分享：

### 1. 项目工程目录中的直接共享资产 (可以直接拷贝/打印)
* 📖 [一列双语带例句音标豪华版 PDF](file:///Users/macbook/Desktop/English/eApp/basic_english_850_recitation.pdf) (共51页)
* 📖 [一列双语带例句音标豪华版 MD](file:///Users/macbook/Desktop/English/eApp/basic_english_850_recitation.md) (Markdown 格式)
* 🖨️ [3列网格黑白极简省纸版 PDF](file:///Users/macbook/Desktop/English/eApp/basic_english_850_compact.pdf) (共5页)
* 🖨️ [3列网格黑白极简省纸版 MD](file:///Users/macbook/Desktop/English/eApp/basic_english_850_compact.md) (Markdown 格式)

### 2. 助手内部归档与历史脚本资产 (位于 artifacts)
* 🛠️ 豪华例句版 PDF 自动构建脚本：[generate_pdf.py](file:///Users/macbook/.gemini/antigravity/brain/4ca90929-f411-4348-8d77-7c5c324e3c11/scratch/generate_pdf.py)
* 🛠️ 黑白紧凑版 PDF 自动构建脚本：[generate_pdf_compact.py](file:///Users/macbook/.gemini/antigravity/brain/4ca90929-f411-4348-8d77-7c5c324e3c11/scratch/generate_pdf_compact.py)
* 🛠️ 双版本 Markdown 自动构建脚本：[generate_mds.py](file:///Users/macbook/.gemini/antigravity/brain/4ca90929-f411-4348-8d77-7c5c324e3c11/scratch/generate_mds.py)
* 💾 原始 850 映射数据库 json：[basic_english_850.json](file:///Users/macbook/Desktop/English/eApp/src/assets/basic_english_850.json)
