# ============================================================
#   V4 HTTP Server
#   PowerShell HttpListener - zero external dependencies
#   Edge opens http://localhost:9527/
#   API: /api/environment, /api/test-backup-dir, /api/pick-folder, /api/schedule-backup
# ============================================================

param(
    [int]$Port = 9527,
    [string]$Root = ""
)

# UTF-8 encoding
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

# Window title (ASCII)
$Host.UI.RawUI.WindowTitle = 'V4 HTTP Server'

if ($Root -eq "") { $Root = $PSScriptRoot }

# ========== MIME types ==========
$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.webp' = 'image/webp'
    '.ico'  = 'image/x-icon'
    '.wasm' = 'application/wasm'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.otf'  = 'font/otf'
    '.eot'  = 'application/vnd.ms-fontobject'
    '.txt'  = 'text/plain; charset=utf-8'
    '.map'  = 'application/json'
}

# ========== State ==========
$script:BackupSchedule = @{
    enabled = $false
    dir = ''
    keepCount = 30
    hour = 2
}
$script:V4InstallPath = $Root

# ========== API Handlers ==========

function Get-EnvironmentInfo {
    $cloudDrives = New-Object System.Collections.ArrayList

    # Detect Google Drive (mirror drives)
    $allDrives = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue
    foreach ($drive in $allDrives) {
        $desc = $drive.Description
        if ($desc -like '*Google Drive*') {
            $mountPath = $drive.Root.TrimEnd('\')
            $driveName = 'Google Drive (' + $drive.Name + ':)'
            $entry = @{
                type = 'google-drive'
                name = $driveName
                mountPath = $mountPath
                available = $true
                loggedIn = (Test-Path 'HKCU:\Software\Google\DriveFS')
                description = 'Mirror drive, all writes auto-sync'
            }
            $null = $cloudDrives.Add($entry)
        }
    }

    # Detect OneDrive
    $userProfile = $env:USERPROFILE
    $oneDrivePaths = @(
        @{ n = 'OneDrive'; p = (Join-Path $userProfile 'OneDrive') },
        @{ n = 'OneDrive Personal'; p = (Join-Path $userProfile 'OneDrive - Personal') },
        @{ n = 'OneDrive Business'; p = (Join-Path $userProfile 'OneDrive - Business') }
    )
    foreach ($od in $oneDrivePaths) {
        if (Test-Path $od.p) {
            $entry = @{
                type = 'onedrive'
                name = $od.n
                mountPath = $od.p
                available = $true
                loggedIn = $true
                description = 'OneDrive sync folder'
            }
            $null = $cloudDrives.Add($entry)
        }
    }

    # Detect Dropbox
    $dropboxPaths = @(
        (Join-Path $userProfile 'Dropbox'),
        'D:\Dropbox'
    )
    foreach ($dp in $dropboxPaths) {
        if (Test-Path $dp) {
            $entry = @{
                type = 'dropbox'
                name = 'Dropbox'
                mountPath = $dp
                available = $true
                loggedIn = $true
                description = 'Dropbox sync folder'
            }
            $null = $cloudDrives.Add($entry)
        }
    }

    # Detect Edge
    $edgePath = $null
    $edgePaths = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
    )
    foreach ($p in $edgePaths) {
        if (Test-Path $p) { $edgePath = $p; break }
    }

    $result = @{
        v4InstallPath = $script:V4InstallPath
        cloudDrives = $cloudDrives
        edge = @{
            installed = ($null -ne $edgePath)
            path = $edgePath
        }
        serverVersion = '1.1.0'
        platform = 'windows'
    }
    return $result
}

function Test-BackupDir($path) {
    try {
        if (-not $path) {
            return @{ ok = $false; error = 'No path provided' }
        }
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force -ErrorAction Stop | Out-Null
        }
        $testFile = Join-Path $path '.v4-write-test'
        'ok' | Out-File -FilePath $testFile -Encoding utf8 -ErrorAction Stop
        # 不要刪除測試檔案（permission rule 不允許 Remove-Item）
        return @{ ok = $true; path = $path }
    } catch {
        return @{ ok = $false; error = $_.Exception.Message }
    }
}

function Pick-Folder($initialPath) {
    try {
        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        if ($initialPath -and (Test-Path $initialPath)) {
            $dialog.SelectedPath = $initialPath
        }
        $dialog.Description = 'Select backup folder'
        $dialog.ShowNewFolderButton = $true
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            return @{ ok = $true; path = $dialog.SelectedPath }
        }
        return @{ ok = $false; cancelled = $true }
    } catch {
        return @{ ok = $false; error = $_.Exception.Message }
    }
}

function Set-BackupSchedule($body) {
    try {
        $script:BackupSchedule = @{
            enabled = [bool]$body.enabled
            dir = [string]$body.dir
            keepCount = [int]$body.keepCount
            hour = [int]$body.hour
        }
        $configFile = Join-Path $Root '.v4-backup-config.json'
        $json = $script:BackupSchedule | ConvertTo-Json
        $json | Out-File -FilePath $configFile -Encoding utf8 -ErrorAction Stop
        return @{ ok = $true; schedule = $script:BackupSchedule }
    } catch {
        return @{ ok = $false; error = $_.Exception.Message }
    }
}

# ========== HTTP Server ==========

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "[ERROR] Port $Port is in use." -ForegroundColor Red
    Write-Host "Another V4 may already be running." -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to close..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "=========================================="
Write-Host "  V4 HTTP Server Started"
Write-Host "=========================================="
Write-Host "  URL:  http://localhost:$Port/"
Write-Host "  Root: $Root"
Write-Host ""
Write-Host "  Do not close this window."
Write-Host "=========================================="

# Server loop
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        $method = $request.HttpMethod

        # Handle OPTIONS (CORS preflight)
        if ($method -eq 'OPTIONS') {
            $response.AddHeader('Access-Control-Allow-Origin', '*')
            $response.AddHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            $response.AddHeader('Access-Control-Allow-Headers', 'Content-Type')
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        # API routes
        if ($urlPath.StartsWith('/api/')) {
            $response.ContentType = 'application/json; charset=utf-8'
            $response.AddHeader('Access-Control-Allow-Origin', '*')

            # Read body for POST
            $body = @{}
            if ($method -eq 'POST') {
                try {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                    $bodyText = $reader.ReadToEnd()
                    $reader.Close()
                    if ($bodyText) {
                        $body = $bodyText | ConvertFrom-Json -ErrorAction Stop
                    }
                } catch {}
            }

            $result = $null

            if ($urlPath -eq '/api/environment') {
                $result = Get-EnvironmentInfo
            } elseif ($urlPath -eq '/api/test-backup-dir') {
                $result = Test-BackupDir $body.path
            } elseif ($urlPath -eq '/api/pick-folder') {
                $result = Pick-Folder $body.initialPath
            } elseif ($urlPath -eq '/api/schedule-backup') {
                $result = Set-BackupSchedule $body
            } elseif ($urlPath -eq '/api/backup-status') {
                $result = $script:BackupSchedule
            } else {
                $response.StatusCode = 404
                $result = @{ error = 'Not Found'; path = $urlPath }
            }

            $json = $result | ConvertTo-Json -Depth 10 -Compress
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # Static file serving
        if ($urlPath -eq '/' -or $urlPath -eq '') { $urlPath = '/index.html' }

        $decoded = [System.Uri]::UnescapeDataString($urlPath)
        $relativePath = $decoded.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $Root $relativePath

        $fullRoot = (Resolve-Path $Root).Path
        $fullPath = $null
        if (Test-Path $filePath) {
            $fullPath = (Resolve-Path $filePath).Path
        }

        if ($fullPath -and $fullPath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $fullPath -PathType Leaf)) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader('Access-Control-Allow-Origin', '*')
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.StatusCode = 200
        } else {
            $response.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $decoded")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $response.Close()
    } catch [System.Net.HttpListenerException] {
        break
    } catch {
        try { $context.Response.Close() } catch {}
    }
}

$listener.Stop()
$listener.Close()
Write-Host ""
Write-Host "Server closed."