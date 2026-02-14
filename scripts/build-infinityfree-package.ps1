[CmdletBinding()]
param(
    [string]$OutputDir = "deploy-infinityfree",
    [switch]$SkipBuild,
    [switch]$SkipComposerInstall,
    [switch]$SkipNpmBuild,
    [switch]$CleanNpmInstall,
    [switch]$Zip
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-ExternalCommand {
    param([Parameter(Mandatory = $true)][string]$Name)

    $candidates = switch ($Name.ToLowerInvariant()) {
        "npm" { @("npm.cmd", "npm") }
        "composer" { @("composer.bat", "composer") }
        "php" { @("php.exe", "php") }
        default { @($Name) }
    }

    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command) {
            return $command.Source
        }
    }

    throw "Unable to resolve command: $Name"
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )

    $resolvedFilePath = Resolve-ExternalCommand -Name $FilePath
    Write-Step "$FilePath $($Arguments -join ' ')"
    $process = Start-Process -FilePath $resolvedFilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Command failed with exit code $($process.ExitCode): $resolvedFilePath $($Arguments -join ' ')"
    }
}

function Invoke-RoboCopy {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -Path $Source)) {
        throw "Source path does not exist: $Source"
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null

    $arguments = @(
        $Source,
        $Destination,
        "/E",
        "/XJ",
        "/R:1",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/NP"
    )

    $process = Start-Process -FilePath "robocopy" -ArgumentList $arguments -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -gt 7) {
        throw "robocopy failed with exit code $($process.ExitCode) for: $Source"
    }
}

function Clear-Directory {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -Path $Path)) {
        return
    }

    $entries = Get-ChildItem -Path $Path -Force
    foreach ($entry in $entries) {
        $removed = $false
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            try {
                Remove-Item -Path $entry.FullName -Recurse -Force -ErrorAction Stop
                $removed = $true
                break
            } catch {
                Start-Sleep -Seconds 1
            }
        }

        if (-not $removed) {
            Write-Warning "Could not remove $($entry.FullName). Continuing."
        }
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = Join-Path $repoRoot $OutputDir

Write-Step "Repository root: $repoRoot"
Write-Step "Output folder: $outputPath"

if (-not $SkipBuild) {
    if (-not $SkipNpmBuild) {
        $nodeModulesPath = Join-Path $repoRoot "node_modules"
        $usedExistingNodeModules = $false

        if ($CleanNpmInstall -or -not (Test-Path -Path $nodeModulesPath)) {
            try {
                Invoke-External -FilePath "npm" -Arguments @("ci") -WorkingDirectory $repoRoot
            } catch {
                Write-Warning "npm ci failed. Falling back to npm install."
                Invoke-External -FilePath "npm" -Arguments @("install") -WorkingDirectory $repoRoot
            }
        } else {
            $usedExistingNodeModules = $true
            Write-Step "Using existing node_modules (skipping npm ci). Use -CleanNpmInstall for a fresh install."
        }

        try {
            Invoke-External -FilePath "npm" -Arguments @("run", "build") -WorkingDirectory $repoRoot
        } catch {
            if (-not $usedExistingNodeModules) {
                throw
            }

            Write-Warning "npm run build failed with existing node_modules. Running npm install and retrying build."
            Invoke-External -FilePath "npm" -Arguments @("install") -WorkingDirectory $repoRoot
            Invoke-External -FilePath "npm" -Arguments @("run", "build") -WorkingDirectory $repoRoot
        }
    }
}

if (Test-Path -Path $outputPath) {
    Write-Step "Removing old package folder"

    $removed = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Remove-Item -Path $outputPath -Recurse -Force -ErrorAction Stop
            $removed = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $removed -and (Test-Path -Path $outputPath)) {
        $stalePath = "$outputPath.stale.$([DateTime]::Now.ToString('yyyyMMddHHmmss'))"
        Rename-Item -Path $outputPath -NewName (Split-Path -Leaf $stalePath)
        Write-Warning "Could not delete old package folder. Renamed it to: $stalePath"
    }
}

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

$directoriesToCopy = @(
    "app",
    "bootstrap",
    "config",
    "database",
    "public",
    "resources",
    "routes",
    "storage"
)

$filesToCopy = @(
    "artisan",
    "composer.json",
    "composer.lock",
    ".env.example"
)

Write-Step "Copying directories"
foreach ($relativePath in $directoriesToCopy) {
    $sourcePath = Join-Path $repoRoot $relativePath
    $destinationPath = Join-Path $outputPath $relativePath
    Invoke-RoboCopy -Source $sourcePath -Destination $destinationPath
}

Write-Step "Copying files"
foreach ($relativePath in $filesToCopy) {
    $sourcePath = Join-Path $repoRoot $relativePath
    $destinationPath = Join-Path $outputPath $relativePath
    if (-not (Test-Path -Path $sourcePath)) {
        throw "Required file not found: $sourcePath"
    }
    Copy-Item -Path $sourcePath -Destination $destinationPath -Force
}

if ($SkipComposerInstall) {
    Write-Step "Skipping composer install; copying local vendor folder"
    Invoke-RoboCopy -Source (Join-Path $repoRoot "vendor") -Destination (Join-Path $outputPath "vendor")
} else {
    Write-Step "Installing production composer dependencies in package folder"
    Invoke-External -FilePath "composer" -Arguments @("install", "--no-dev", "--optimize-autoloader", "--no-interaction") -WorkingDirectory $outputPath
}

Write-Step "Cleaning runtime caches/logs from package"
$pathsToClear = @(
    "storage\framework\cache\data",
    "storage\framework\sessions",
    "storage\framework\testing",
    "storage\framework\views",
    "storage\logs"
)
foreach ($relativePath in $pathsToClear) {
    Clear-Directory -Path (Join-Path $outputPath $relativePath)
}

# InfinityFree disables symlink creation; copy physical storage files into public/storage.
$storagePublicSource = Join-Path $repoRoot "storage\app\public"
$publicStorageDestination = Join-Path $outputPath "public\storage"
if (Test-Path -Path $storagePublicSource) {
    Write-Step "Populating public/storage with storage/app/public contents"
    Invoke-RoboCopy -Source $storagePublicSource -Destination $publicStorageDestination
}

# Add root rewrite rule so users can upload this folder directly into htdocs.
$rootHtaccessPath = Join-Path $outputPath ".htaccess"
$rootHtaccessContent = @"
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/public/
RewriteRule ^(.*)$ public/`$1 [L]
"@
Set-Content -Path $rootHtaccessPath -Value $rootHtaccessContent -NoNewline

$envCandidates = @(".env.infinityfree", ".env.production")
$copiedEnv = $false
foreach ($candidate in $envCandidates) {
    $candidatePath = Join-Path $repoRoot $candidate
    if (Test-Path -Path $candidatePath) {
        Copy-Item -Path $candidatePath -Destination (Join-Path $outputPath ".env") -Force
        Write-Step "Copied $candidate as package .env"
        $copiedEnv = $true
        break
    }
}

if (-not $copiedEnv) {
    Write-Warning "No .env.infinityfree or .env.production found. Create $outputPath\.env before uploading."
}

$requiredPackagePaths = @(
    "public\index.php",
    "public\build",
    "vendor",
    "artisan",
    ".htaccess"
)
foreach ($relativePath in $requiredPackagePaths) {
    if (-not (Test-Path -Path (Join-Path $outputPath $relativePath))) {
        throw "Package validation failed. Missing: $relativePath"
    }
}

if ($Zip) {
    $zipPath = "$outputPath.zip"
    if (Test-Path -Path $zipPath) {
        Remove-Item -Path $zipPath -Force
    }
    Write-Step "Creating zip archive: $zipPath"
    Compress-Archive -Path (Join-Path $outputPath "*") -DestinationPath $zipPath
}

Write-Step "InfinityFree package ready: $outputPath"
Write-Host "Upload all contents of this folder to /htdocs on InfinityFree." -ForegroundColor Green
