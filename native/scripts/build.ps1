[CmdletBinding()]
param(
    [string] $BuildDirectory,
    [ValidateSet('Debug', 'Release', 'RelWithDebInfo')]
    [string] $Configuration = 'Release',
    [switch] $SkipTests
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nativeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($BuildDirectory)) {
    $BuildDirectory = Join-Path $nativeRoot 'build'
}
$buildRoot = [IO.Path]::GetFullPath($BuildDirectory)
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere -PathType Leaf)) {
    throw 'Visual Studio Installer (vswhere.exe) was not found.'
}

$visualStudio = (& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath).Trim()
if (-not $visualStudio) {
    throw 'Visual Studio 2022 C++ Build Tools were not found.'
}

$windowsSdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$windowsSdkIncludeRoot = Join-Path $windowsSdkRoot 'Include'
$windowsSdk = if (Test-Path -LiteralPath $windowsSdkIncludeRoot -PathType Container) {
    Get-ChildItem -LiteralPath $windowsSdkIncludeRoot -Directory | Where-Object {
        (Test-Path -LiteralPath (Join-Path $_.FullName 'um\Windows.h') -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $_.FullName 'ucrt\stddef.h') -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $windowsSdkRoot "bin\$($_.Name)\x64\fxc.exe") -PathType Leaf)
    } | Sort-Object { [Version] $_.Name } -Descending | Select-Object -First 1
}
if (-not $windowsSdk) {
    throw 'A complete Windows 10/11 SDK was not found. Install its Desktop C++ headers, UCRT, libraries, and HLSL Tools (fxc.exe) with Visual Studio Installer.'
}
$windowsSdkVersion = $windowsSdk.Name
$env:WindowsSdkDir = $windowsSdkRoot.TrimEnd('\') + '\'
$env:WindowsSDKVersion = "$windowsSdkVersion\"
$env:WindowsSdkVerBinPath = Join-Path $windowsSdkRoot "bin\$windowsSdkVersion\"

$configureArguments = @(
    '-S', $nativeRoot,
    '-B', $buildRoot,
    '-G', 'Visual Studio 17 2022',
    '-A', 'x64',
    "-DCMAKE_GENERATOR_INSTANCE=$visualStudio",
    "-DCMAKE_SYSTEM_VERSION=$windowsSdkVersion",
    "-DANIME4K_NATIVE_BUILD_TESTS=$([int](-not $SkipTests))"
)
& cmake @configureArguments
if ($LASTEXITCODE -ne 0) { throw "CMake configure failed with exit code $LASTEXITCODE." }

& cmake --build $buildRoot --config $Configuration --parallel
if ($LASTEXITCODE -ne 0) { throw "Native build failed with exit code $LASTEXITCODE." }

if (-not $SkipTests) {
    & ctest --test-dir $buildRoot -C $Configuration --output-on-failure
    if ($LASTEXITCODE -ne 0) { throw "Native tests failed with exit code $LASTEXITCODE." }
}

Write-Host "Native binaries: $(Join-Path $buildRoot "bin\$Configuration")"
