[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $BinaryDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$hostName = 'io.github.anime4k_browser.native'
$chromeExtensionId = 'dlomjcbmgkfaebhplgoihbjfclaagike'
$firefoxExtensionId = 'anime4k-webextension@chenmozhijin'
$nativeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
if (-not $localAppData) {
    throw 'The per-user LocalAppData directory could not be resolved.'
}
$installRoot = [IO.Path]::GetFullPath((Join-Path $localAppData 'Anime4KBrowserNative'))
$marker = Join-Path $installRoot '.anime4k-native-install'
$installPrefix = $installRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

function Assert-OwnedInstallChild {
    param([Parameter(Mandatory)] [string] $Path)
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($installPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside the Anime4K installation: $fullPath"
    }
    return $fullPath
}

function Copy-OwnedTree {
    param(
        [Parameter(Mandatory)] [string] $Source,
        [Parameter(Mandatory)] [string] $Destination
    )
    $ownedDestination = Assert-OwnedInstallChild $Destination
    if (Test-Path -LiteralPath $ownedDestination -PathType Container) {
        $destinationItem = Get-Item -LiteralPath $ownedDestination -Force
        if (($destinationItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to replace the reparse point $ownedDestination."
        }
        Remove-Item -LiteralPath $ownedDestination -Recurse -Force
    } elseif (Test-Path -LiteralPath $ownedDestination) {
        throw "Refusing to replace non-directory path $ownedDestination."
    }
    Copy-Item -LiteralPath $Source -Destination $ownedDestination -Recurse -Force
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
        if ([string]::IsNullOrWhiteSpace([string] $entry.destination)) {
            throw 'A native payload manifest entry is missing its destination.'
        }
    }
    return $entries
}

if (Test-Path -LiteralPath $installRoot -PathType Container) {
    $installItem = Get-Item -LiteralPath $installRoot -Force
    if (($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to install through the reparse point $installRoot."
    }
    $existingEntries = @(Get-ChildItem -LiteralPath $installRoot -Force)
    if ($existingEntries.Count -gt 0 -and -not (Test-Path -LiteralPath $marker -PathType Leaf)) {
        throw "Refusing to modify $installRoot because it is non-empty and its Anime4K install marker is missing."
    }
    if ((Test-Path -LiteralPath $marker -PathType Leaf) -and
        [IO.File]::ReadAllText($marker).Trim() -ne $hostName) {
        throw "Refusing to modify $installRoot because its Anime4K install marker is invalid."
    }
}

if (-not $BinaryDirectory) {
    $candidates = @(
        (Join-Path $nativeRoot 'build\bin\Release'),
        (Join-Path $nativeRoot 'build-ninja\bin'),
        $nativeRoot
    )
    $BinaryDirectory = $candidates | Where-Object {
        (Test-Path -LiteralPath (Join-Path $_ 'Anime4K.NativeHost.exe') -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $_ 'Anime4K.Renderer.exe') -PathType Leaf)
    } | Select-Object -First 1
}
if (-not $BinaryDirectory) {
    throw 'Native binaries were not found. Build first or pass -BinaryDirectory.'
}
$binaryRoot = [IO.Path]::GetFullPath($BinaryDirectory)
foreach ($name in @('Anime4K.NativeHost.exe', 'Anime4K.Renderer.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $binaryRoot $name) -PathType Leaf)) {
        throw "$name was not found in $binaryRoot."
    }
}
$payloadManifestPath = Join-Path $nativeRoot 'payload-manifest.json'
$payloadEntries = @(Read-NativePayloadManifest -Path $payloadManifestPath)
$binaryPrefix = $binaryRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
foreach ($entry in $payloadEntries) {
    $relativePath = [string] $entry.destination
    $payloadPath = [IO.Path]::GetFullPath((Join-Path $binaryRoot $relativePath))
    if (-not $payloadPath.StartsWith($binaryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Native payload destination escapes the binary directory: $relativePath"
    }
    if (-not (Test-Path -LiteralPath $payloadPath -PathType Leaf)) {
        throw "$relativePath was not found in $binaryRoot. Rebuild the native renderer before installing."
    }
}
$modelRoot = Join-Path $binaryRoot 'models'
$licenseRoot = Join-Path $binaryRoot 'licenses'
$utf8 = [Text.UTF8Encoding]::new($false)

if ($PSCmdlet.ShouldProcess($installRoot, 'Install AniWebScale native host')) {
    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    # Write ownership first so any later copy/registry failure remains safely
    # repairable by rerunning this installer or the uninstaller.
    [IO.File]::WriteAllText($marker, $hostName, $utf8)
    Copy-Item -LiteralPath (Join-Path $binaryRoot 'Anime4K.NativeHost.exe') -Destination $installRoot -Force
    Copy-Item -LiteralPath (Join-Path $binaryRoot 'Anime4K.Renderer.exe') -Destination $installRoot -Force
    Copy-OwnedTree -Source $modelRoot -Destination (Join-Path $installRoot 'models')
    Copy-OwnedTree -Source $licenseRoot -Destination (Join-Path $installRoot 'licenses')
    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $nativeRoot '..'))
    $documentation = @(
        [pscustomobject]@{
            Target = 'NATIVE-README.md'
            Candidates = @(
                (Join-Path $nativeRoot 'NATIVE-README.md'),
                (Join-Path $nativeRoot 'README.md')
            )
        },
        [pscustomobject]@{
            Target = 'LICENSE'
            Candidates = @(
                (Join-Path $nativeRoot 'LICENSE'),
                (Join-Path $repositoryRoot 'LICENSE'),
                (Join-Path $nativeRoot 'LICENSE.txt')
            )
        },
        [pscustomobject]@{
            Target = 'THIRD_PARTY_NOTICES.md'
            Candidates = @(
                (Join-Path $nativeRoot 'THIRD_PARTY_NOTICES.md'),
                (Join-Path $repositoryRoot 'THIRD_PARTY_NOTICES.md')
            )
        }
    )
    foreach ($item in $documentation) {
        $source = $item.Candidates | Where-Object {
            Test-Path -LiteralPath $_ -PathType Leaf
        } | Select-Object -First 1
        if ($source) {
            Copy-Item -LiteralPath $source -Destination (Join-Path $installRoot $item.Target) -Force
        }
    }
    $hostPath = Join-Path $installRoot 'Anime4K.NativeHost.exe'
    $chromeManifestPath = Join-Path $installRoot 'chrome-native-host.json'
    $firefoxManifestPath = Join-Path $installRoot 'firefox-native-host.json'
    $allowlistPath = Join-Path $installRoot 'native-host-allowlist.json'

    $chromeManifest = [ordered]@{
        name = $hostName
        description = 'AniWebScale native Windows renderer'
        path = $hostPath
        type = 'stdio'
        allowed_origins = @("chrome-extension://$chromeExtensionId/")
    } | ConvertTo-Json -Depth 4
    $firefoxManifest = [ordered]@{
        name = $hostName
        description = 'AniWebScale native Windows renderer'
        path = $hostPath
        type = 'stdio'
        allowed_extensions = @($firefoxExtensionId)
    } | ConvertTo-Json -Depth 4
    $allowlist = [ordered]@{
        allowedCallers = @("chrome-extension://$chromeExtensionId/", $firefoxExtensionId)
    } | ConvertTo-Json -Depth 3

    [IO.File]::WriteAllText($chromeManifestPath, $chromeManifest, $utf8)
    [IO.File]::WriteAllText($firefoxManifestPath, $firefoxManifest, $utf8)
    [IO.File]::WriteAllText($allowlistPath, $allowlist, $utf8)
    $chromeKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
    $firefoxKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\$hostName"
    New-Item -Path $chromeKey -Force | Out-Null
    Set-Item -Path $chromeKey -Value $chromeManifestPath
    New-Item -Path $firefoxKey -Force | Out-Null
    Set-Item -Path $firefoxKey -Value $firefoxManifestPath

    Write-Host "Installed $hostName into $installRoot"
    Write-Host 'Restart Chrome and Firefox before testing the native backend.'
}
