# Swap Copilot Instructions
# Switches between main app instructions and Power Towers game instructions

$mainInstructions = ".github\copilot-instructions.md"
$gameInstructions = "addons-dev\power-towers\.github\copilot-instructions.md"
$backupSuffix = ".backup"

# Check which mode is currently active by reading first line
$firstLine = Get-Content $mainInstructions -First 1

if ($firstLine -match "Power Towers") {
    # Currently in GAME mode -> switch to APP mode
    Write-Host "Switching to APP mode..." -ForegroundColor Cyan
    
    # Restore app instructions from backup
    if (Test-Path "$mainInstructions$backupSuffix") {
        Copy-Item "$mainInstructions$backupSuffix" $mainInstructions -Force
        Remove-Item "$mainInstructions$backupSuffix"
        Write-Host "[OK] Switched to APP instructions" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Backup not found! Cannot restore." -ForegroundColor Red
    }
} else {
    # Currently in APP mode -> switch to GAME mode
    Write-Host "Switching to GAME mode..." -ForegroundColor Yellow
    
    # Backup current app instructions
    Copy-Item $mainInstructions "$mainInstructions$backupSuffix" -Force
    
    # Copy game instructions to main
    Copy-Item $gameInstructions $mainInstructions -Force
    
    Write-Host "[OK] Switched to POWER TOWERS instructions" -ForegroundColor Green
}

# Show current mode
$currentFirst = Get-Content $mainInstructions -First 1
if ($currentFirst -match "Power Towers") {
    Write-Host ""
    Write-Host "[GAME] Current mode: POWER TOWERS" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "[APP] Current mode: MAIN APP" -ForegroundColor Cyan
}
