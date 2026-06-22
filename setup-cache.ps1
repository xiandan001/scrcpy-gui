# 设置 electron-builder 缓存
$cacheDir = "$env:LOCALAPPDATA\electron-builder\cache"

# 创建目录
New-Item -ItemType Directory -Force -Path "$cacheDir\winCodeSign" | Out-Null
New-Item -ItemType Directory -Force -Path "$cacheDir\nsis" | Out-Null

# 解压 winCodeSign
if (Test-Path ".electron-cache\winCodeSign-2.6.0.7z") {
    Write-Host "解压 winCodeSign..."
    # 使用 7z 或 PowerShell 5.0+ 的 Expand-Archive 不支持 7z，需要 7-Zip
    # 这里假设您有 7z 在 PATH 中
    & 7z x ".electron-cache\winCodeSign-2.6.0.7z" -o"$cacheDir\winCodeSign\winCodeSign-2.6.0" -y
}

Write-Host "缓存设置完成"
