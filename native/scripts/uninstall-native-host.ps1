[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nativeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$identityPath = Join-Path $nativeRoot 'extension-identities.json'
if (-not (Test-Path -LiteralPath $identityPath -PathType Leaf)) {
    throw "Extension identity file is missing: $identityPath"
}
$identities = Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
$hostName = [string] $identities.nativeHostName
$localAppData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
if (-not $localAppData) {
    throw 'The per-user LocalAppData directory could not be resolved.'
}
$installRoot = [IO.Path]::GetFullPath((Join-Path $localAppData 'Anime4KBrowserNative'))
$marker = Join-Path $installRoot '.anime4k-native-install'
$installPrefix = $installRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

function Remove-OwnedInstallTree {
    param([Parameter(Mandatory)] [string] $Path)
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($installPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to remove a path outside the Anime4K installation: $fullPath"
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) { return }
    $item = Get-Item -LiteralPath $fullPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to uninstall through the reparse point $fullPath."
    }
    Remove-Item -LiteralPath $fullPath -Recurse -Force
}
if (Test-Path -LiteralPath $installRoot -PathType Container) {
    $installItem = Get-Item -LiteralPath $installRoot -Force
    if (($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to uninstall through the reparse point $installRoot."
    }
}
if ((Test-Path -LiteralPath $installRoot) -and -not (Test-Path -LiteralPath $marker -PathType Leaf)) {
    throw "Refusing to modify $installRoot because its Anime4K install marker is missing."
}
if ((Test-Path -LiteralPath $marker -PathType Leaf) -and
    [IO.File]::ReadAllText($marker).Trim() -ne $hostName) {
    throw "Refusing to modify $installRoot because its Anime4K install marker is invalid."
}

if ($PSCmdlet.ShouldProcess($installRoot, 'Uninstall AniWebScale native host')) {
    foreach ($registration in @(
        [pscustomobject]@{
            Key = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
            Manifest = (Join-Path $installRoot 'chrome-native-host.json')
        },
        [pscustomobject]@{
            Key = "HKCU:\Software\Mozilla\NativeMessagingHosts\$hostName"
            Manifest = (Join-Path $installRoot 'firefox-native-host.json')
        }
    )) {
        if (Test-Path -LiteralPath $registration.Key) {
            $registeredValue = (Get-Item -LiteralPath $registration.Key).GetValue('')
            $ownsRegistration = $false
            if ($registeredValue -is [string] -and -not [String]::IsNullOrWhiteSpace($registeredValue)) {
                try {
                    $registeredPath = [IO.Path]::GetFullPath($registeredValue)
                    $expectedPath = [IO.Path]::GetFullPath($registration.Manifest)
                    $ownsRegistration = $registeredPath.Equals($expectedPath, [StringComparison]::OrdinalIgnoreCase)
                } catch {
                    $ownsRegistration = $false
                }
            }
            if ($ownsRegistration) {
                Remove-Item -LiteralPath $registration.Key -Force
            } else {
                Write-Warning "Left $($registration.Key) in place because it no longer points to this installation."
            }
        }
    }
    $ownedFiles = @(
        'Anime4K.NativeHost.exe',
        'Anime4K.Renderer.exe',
        'NATIVE-README.md',
        'LICENSE',
        'THIRD_PARTY_NOTICES.md',
        'chrome-native-host.json',
        'firefox-native-host.json',
        'native-host-allowlist.json',
        '.anime4k-native-install'
    )
    foreach ($name in $ownedFiles) {
        $path = Join-Path $installRoot $name
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            Remove-Item -LiteralPath $path -Force
        }
    }
    Remove-OwnedInstallTree (Join-Path $installRoot 'models')
    Remove-OwnedInstallTree (Join-Path $installRoot 'licenses')
    if (Test-Path -LiteralPath $installRoot -PathType Container) {
        $remainingEntries = @(Get-ChildItem -LiteralPath $installRoot -Force)
        if ($remainingEntries.Count -eq 0) {
            Remove-Item -LiteralPath $installRoot -Force
        } else {
            Write-Warning "Left $installRoot in place because it contains files not owned by AniWebScale."
        }
    }
    Write-Host "Uninstalled $hostName."
}
