[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release', 'RelWithDebInfo')]
    [string] $Configuration = 'Release',
    [switch] $SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-ZipFromDirectory {
    param(
        [Parameter(Mandatory)] [string] $SourceDirectory,
        [Parameter(Mandatory)] [string] $DestinationPath
    )

    $sourceRoot = [IO.Path]::GetFullPath($SourceDirectory)
    $sourcePrefix = $sourceRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (Test-Path -LiteralPath $DestinationPath) {
        Remove-Item -LiteralPath $DestinationPath -Force
    }

    $archive = [IO.Compression.ZipFile]::Open(
        $DestinationPath,
        [IO.Compression.ZipArchiveMode]::Create
    )
    try {
        foreach ($file in Get-ChildItem -LiteralPath $sourceRoot -Recurse -File | Sort-Object FullName) {
            if (-not $file.FullName.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Refusing to archive a file outside the source directory: $($file.FullName)"
            }
            $relativePath = $file.FullName.Substring($sourcePrefix.Length)
            $entryName = $relativePath.Replace([IO.Path]::DirectorySeparatorChar, [char] '/')
            $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = $file.LastWriteTime
            $inputStream = $file.OpenRead()
            $outputStream = $entry.Open()
            try {
                $inputStream.CopyTo($outputStream)
            } finally {
                $outputStream.Dispose()
                $inputStream.Dispose()
            }
        }
    } finally {
        $archive.Dispose()
    }
}

function Read-NativePayloadManifest {
    param([Parameter(Mandatory)] [string] $Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Native payload manifest is missing: $Path"
    }
    $manifest = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ([int] $manifest.version -ne 1) {
        throw "Unsupported native payload manifest version: $($manifest.version)"
    }
    $entries = @($manifest.files)
    if ($entries.Count -eq 0) {
        throw 'The native payload manifest is empty.'
    }
    foreach ($entry in $entries) {
        if ([string]::IsNullOrWhiteSpace([string] $entry.source) -or
            [string]::IsNullOrWhiteSpace([string] $entry.destination)) {
            throw 'A native payload manifest entry is missing source or destination.'
        }
    }
    return $entries
}

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artifactRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'artifacts'))
$expectedPrefix = $repoRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $artifactRoot.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to package outside the repository: $artifactRoot"
}

$tempRoot = Join-Path $repoRoot '.tmp'
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
$env:TEMP = $tempRoot
$env:TMP = $tempRoot

Push-Location $repoRoot
try {
    if (-not $SkipBuild) {
        & npm.cmd run build:all
        if ($LASTEXITCODE -ne 0) { throw "Extension build failed with exit code $LASTEXITCODE." }

        & (Join-Path $repoRoot 'native\scripts\build.ps1') -Configuration $Configuration
        if ($LASTEXITCODE -ne 0) { throw "Native build failed with exit code $LASTEXITCODE." }
    }

    $chromeSource = Join-Path $repoRoot 'dist-chrome'
    $firefoxSource = Join-Path $repoRoot 'dist-firefox'
    $nativeSource = Join-Path $repoRoot "native\build\bin\$Configuration"
    $nativeRoot = Join-Path $repoRoot 'native'
    $payloadManifestPath = Join-Path $nativeRoot 'payload-manifest.json'
    $payloadEntries = @(Read-NativePayloadManifest -Path $payloadManifestPath)
    foreach ($required in @(
        (Join-Path $chromeSource 'manifest.json'),
        (Join-Path $firefoxSource 'manifest.json'),
        (Join-Path $nativeSource 'Anime4K.NativeHost.exe'),
        (Join-Path $nativeSource 'Anime4K.Renderer.exe')
    )) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Required build output is missing: $required"
        }
    }
    $nativeSourcePrefix = [IO.Path]::GetFullPath($nativeSource).TrimEnd(
        [IO.Path]::DirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar
    foreach ($entry in $payloadEntries) {
        $payloadSource = [IO.Path]::GetFullPath((Join-Path $nativeRoot ([string] $entry.source)))
        $payloadOutput = [IO.Path]::GetFullPath((Join-Path $nativeSource ([string] $entry.destination)))
        if (-not $payloadOutput.StartsWith($nativeSourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Native payload destination escapes the build output: $($entry.destination)"
        }
        if (-not (Test-Path -LiteralPath $payloadSource -PathType Leaf)) {
            throw "Native payload source is missing: $payloadSource"
        }
        if (-not (Test-Path -LiteralPath $payloadOutput -PathType Leaf)) {
            throw "Required build output is missing: $payloadOutput"
        }
        $sourceHash = (Get-FileHash -LiteralPath $payloadSource -Algorithm SHA256).Hash
        $outputHash = (Get-FileHash -LiteralPath $payloadOutput -Algorithm SHA256).Hash
        if ($sourceHash -ne $outputHash) {
            throw "Native payload build output is stale: $payloadOutput"
        }
    }

    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    $artifactPrefix = $artifactRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    foreach ($packageName in @(
        'chrome-unpacked',
        'anime4k-browser-chrome-1.0.0.zip',
        'anime4k-browser-firefox-1.0.0.xpi',
        'anime4k-native-windows-x64-1.0.0.zip',
        'aniwebscale-chrome-1.0.0.zip',
        'aniwebscale-firefox-1.0.0.xpi',
        'aniwebscale-native-windows-x64-1.0.0.zip'
    )) {
        $packagePath = [IO.Path]::GetFullPath((Join-Path $artifactRoot $packageName))
        if (-not $packagePath.StartsWith($artifactPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to clear a package path outside the artifact directory: $packagePath"
        }
        if (Test-Path -LiteralPath $packagePath) {
            Remove-Item -LiteralPath $packagePath -Recurse -Force
        }
    }

    $chromeUnpacked = Join-Path $artifactRoot 'chrome-unpacked'
    Copy-Item -LiteralPath $chromeSource -Destination $chromeUnpacked -Recurse
    Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE') -Destination $chromeUnpacked
    Copy-Item -LiteralPath (Join-Path $repoRoot 'THIRD_PARTY_NOTICES.md') -Destination $chromeUnpacked

    $chromeZip = Join-Path $artifactRoot 'aniwebscale-chrome-1.0.0.zip'
    New-ZipFromDirectory -SourceDirectory $chromeUnpacked -DestinationPath $chromeZip

    $firefoxStage = Join-Path $tempRoot 'firefox-package'
    if (Test-Path -LiteralPath $firefoxStage) {
        $resolvedStage = [IO.Path]::GetFullPath($firefoxStage)
        if (-not $resolvedStage.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to clear temporary directory outside the repository: $resolvedStage"
        }
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
    Copy-Item -LiteralPath $firefoxSource -Destination $firefoxStage -Recurse
    Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE') -Destination $firefoxStage
    Copy-Item -LiteralPath (Join-Path $repoRoot 'THIRD_PARTY_NOTICES.md') -Destination $firefoxStage
    $firefoxXpi = Join-Path $artifactRoot 'aniwebscale-firefox-1.0.0.xpi'
    New-ZipFromDirectory -SourceDirectory $firefoxStage -DestinationPath $firefoxXpi

    $nativeStage = Join-Path $tempRoot 'native-package'
    if (Test-Path -LiteralPath $nativeStage) {
        $resolvedStage = [IO.Path]::GetFullPath($nativeStage)
        if (-not $resolvedStage.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to clear temporary directory outside the repository: $resolvedStage"
        }
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
    New-Item -ItemType Directory -Path (Join-Path $nativeStage 'scripts') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $nativeSource 'Anime4K.NativeHost.exe') -Destination $nativeStage
    Copy-Item -LiteralPath (Join-Path $nativeSource 'Anime4K.Renderer.exe') -Destination $nativeStage
    Copy-Item -LiteralPath (Join-Path $nativeSource 'models') -Destination $nativeStage -Recurse
    Copy-Item -LiteralPath (Join-Path $nativeSource 'licenses') -Destination $nativeStage -Recurse
    Copy-Item -LiteralPath $payloadManifestPath -Destination $nativeStage
    Copy-Item -LiteralPath (Join-Path $repoRoot 'native\scripts\install-native-host.ps1') -Destination (Join-Path $nativeStage 'scripts')
    Copy-Item -LiteralPath (Join-Path $repoRoot 'native\scripts\uninstall-native-host.ps1') -Destination (Join-Path $nativeStage 'scripts')
    Copy-Item -LiteralPath (Join-Path $repoRoot 'native\Install Anime4K Native.cmd') -Destination $nativeStage
    Copy-Item -LiteralPath (Join-Path $repoRoot 'native\Uninstall Anime4K Native.cmd') -Destination $nativeStage
    Copy-Item -LiteralPath (Join-Path $repoRoot 'native\README.md') -Destination (Join-Path $nativeStage 'NATIVE-README.md')
    Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE') -Destination $nativeStage
    Copy-Item -LiteralPath (Join-Path $repoRoot 'THIRD_PARTY_NOTICES.md') -Destination $nativeStage

    $allowlist = [ordered]@{
        allowedCallers = @(
            'chrome-extension://dlomjcbmgkfaebhplgoihbjfclaagike/',
            'anime4k-webextension@chenmozhijin'
        )
    } | ConvertTo-Json -Depth 3
    [IO.File]::WriteAllText(
        (Join-Path $nativeStage 'native-host-allowlist.json'),
        $allowlist,
        [Text.UTF8Encoding]::new($false)
    )

    $nativeZip = Join-Path $artifactRoot 'aniwebscale-native-windows-x64-1.0.0.zip'
    New-ZipFromDirectory -SourceDirectory $nativeStage -DestinationPath $nativeZip

    Write-Host "Packages created in $artifactRoot"
} finally {
    Pop-Location
}
