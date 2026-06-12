@echo off
chcp 65001 > nul
echo ==================================================
echo         eApp Tauri 本地 Rust 编译缓存清理工具
echo ==================================================
echo.

set TARGET_DIR=%~dp0src-tauri\target

if exist "%TARGET_DIR%" (
    echo 发现编译缓存目录：%TARGET_DIR%
    echo 正在清理中，请稍候...
    rd /s /q "%TARGET_DIR%"
    if not exist "%TARGET_DIR%" (
        echo.
        echo [成功] 清理完成！已成功删除临时编译文件。
        echo 磁盘空间已成功释放（通常为 1.5 GB ~ 3 GB）。
    ) else (
        echo.
        echo [错误] 清理失败，部分文件可能正在被其他程序（如 VS Code 或运行中的客户端）占用。
        echo 请关闭相关软件后再试。
    )
) else (
    echo 未检测到编译缓存目录（%TARGET_DIR%），无需清理。
)

echo.
echo ==================================================
pause
