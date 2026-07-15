[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $BinaryDirectory,
    [string] $OutputPath,
    [ValidateRange(0, 10)]
    [int] $WarmupFrames = 2,
    [ValidateRange(1, 60)]
    [int] $SampleFrames = 12,
    [ValidateRange(30, 1800)]
    [int] $MaximumSeconds = 600,
    [ValidateRange(1, 120)]
    [int] $GpuTimeoutSeconds = 30,
    [ValidateLength(1, 128)]
    [string] $RequiredAdapter = 'RX 6750 XT',
    [switch] $AllowBudgetMisses
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nativeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $BinaryDirectory) {
    $candidates = @(
        (Join-Path $nativeRoot 'build\bin\Release'),
        (Join-Path $nativeRoot 'build\bin'),
        (Join-Path $nativeRoot 'build-exact\bin'),
        (Join-Path $nativeRoot 'tools'),
        $nativeRoot
    )
    $BinaryDirectory = $candidates | Where-Object {
        Test-Path -LiteralPath (Join-Path $_ 'Anime4K.Benchmark.exe') -PathType Leaf
    } | Select-Object -First 1
}
if (-not $BinaryDirectory) {
    throw 'Anime4K.Benchmark.exe was not found. Build the native Release target or pass -BinaryDirectory.'
}
$benchmark = Join-Path ([IO.Path]::GetFullPath($BinaryDirectory)) 'Anime4K.Benchmark.exe'
if (-not (Test-Path -LiteralPath $benchmark -PathType Leaf)) {
    throw "Benchmark executable was not found: $benchmark"
}

if (-not $OutputPath) {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path $nativeRoot "out\benchmarks\rx6750xt-$timestamp.json"
}
$report = [IO.Path]::GetFullPath($OutputPath)
if ([IO.Path]::GetExtension($report) -ne '.json') {
    throw 'Benchmark output must use a .json extension.'
}

$arguments = @(
    '--output', $report,
    '--warmup', $WarmupFrames,
    '--samples', $SampleFrames,
    '--max-seconds', $MaximumSeconds,
    '--gpu-timeout-seconds', $GpuTimeoutSeconds,
    '--require-adapter', $RequiredAdapter
)

$description = "Run bounded 1920x1080 -> 2560x1440 benchmark ($WarmupFrames warmup, $SampleFrames samples, max ${MaximumSeconds}s)"
if ($PSCmdlet.ShouldProcess($report, $description)) {
    $reportDirectory = Split-Path -Parent $report
    New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
    & $benchmark @arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0 -and -not ($AllowBudgetMisses -and $exitCode -eq 7)) {
        throw "Benchmark exited with code $exitCode. A partial JSON report may exist at $report."
    }
    if (-not (Test-Path -LiteralPath $report -PathType Leaf)) {
        throw 'Benchmark completed without creating its JSON report.'
    }
    $result = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
    if ($result.acceptancePassed -ne $true -and -not $AllowBudgetMisses) {
        $overBudget = @($result.presets | Where-Object { $_.budgetMisses -gt 0 } | ForEach-Object {
            "$($_.mode)/$($_.quality)"
        }) -join ', '
        throw "The 24 FPS acceptance target failed for: $overBudget. The JSON report remains at $report."
    }
    Write-Host "Benchmark report: $report"
}
