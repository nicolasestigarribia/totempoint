# Instala Claude Code (Claude CLI) en Windows
$ErrorActionPreference = "Stop"

Write-Host "== Setup Claude Code ==" -ForegroundColor Cyan

# 1. Verificar si ya esta instalado
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) {
    Write-Host "Claude Code ya instalado: $(claude --version)" -ForegroundColor Green
    Write-Host "Para actualizar: claude update" -ForegroundColor Yellow
    exit 0
}

# 2. Instalar (instalador nativo, no requiere Node)
Write-Host "Instalando Claude Code..." -ForegroundColor Yellow
powershell -c "irm https://claude.ai/install.ps1 | iex"

# 3. Refrescar PATH en la sesion actual
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "Machine")

# 4. Verificar
$claude = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claude) {
    Write-Host "Instalado pero no esta en PATH. Cerra y abri la terminal, y corre 'claude'." -ForegroundColor Red
    exit 1
}

Write-Host "Listo: $(claude --version)" -ForegroundColor Green
Write-Host "Corre 'claude' en la raiz del proyecto. Primera vez pide login con la cuenta Pro." -ForegroundColor Cyan
