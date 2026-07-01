Add-Type -AssemblyName System.Windows.Forms
$ServerDir = 'C:\Users\sunpe\dev\v4-resident-system\server'
Write-Host "starting server..."
$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','node --import tsx/esm src/index.ts' -WorkingDirectory $ServerDir -PassThru -WindowStyle Hidden -RedirectStandardOutput 'C:\Users\sunpe\dev\v4-resident-system\logs\test-server.log' -RedirectStandardError 'C:\Users\sunpe\dev\v4-resident-system\logs\test-server.err.log'
Write-Host "started PID: $($p.Id)"
Start-Sleep 5
if (-not $p.HasExited) {
  Write-Host "still running"
  Write-Host "Health check..."
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3
    Write-Host "Health: $($r.StatusCode)"
  } catch {
    Write-Host "Health: NOT up - $($_.Exception.Message)"
  }
} else {
  Write-Host "exited: $($p.ExitCode)"
  Write-Host "--- log ---"
  Get-Content 'C:\Users\sunpe\dev\v4-resident-system\logs\test-server.err.log' -Tail -10
}
Read-Host "Press Enter to exit"