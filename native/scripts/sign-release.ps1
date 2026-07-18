[CmdletBinding()]
param(
    [string] $BinaryDirectory,
    [string] $PfxPath = $env:ANIME4K_SIGNING_PFX_PATH,
    [string] $PfxPassword = $env:ANIME4K_SIGNING_PFX_PASSWORD,
    [string] $TimestampUrl = 'http://timestamp.digicert.com',
    [switch] $VerifyOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Security

$nativeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($BinaryDirectory)) {
    $BinaryDirectory = Join-Path $nativeRoot 'build\bin\Release'
}
$binaryRoot = [IO.Path]::GetFullPath($BinaryDirectory)
$requiredNames = @('Anime4K.NativeHost.exe', 'Anime4K.Renderer.exe')
$manifestPath = Join-Path $binaryRoot 'native-release-manifest.json'
$manifestSignaturePath = "$manifestPath.p7s"

function Get-RequiredBinaryPaths {
    $paths = @()
    foreach ($name in $requiredNames) {
        $path = Join-Path $binaryRoot $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Required release binary is missing: $path"
        }
        $paths += $path
    }
    return $paths
}

function Assert-CodeSignature {
    param([Parameter(Mandatory)] [string] $Path)
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
        throw "Authenticode verification failed for $Path ($($signature.Status): $($signature.StatusMessage))"
    }
    if ($null -eq $signature.SignerCertificate) {
        throw "Authenticode signature has no signer certificate: $Path"
    }
    return $signature.SignerCertificate
}

function Test-DetachedManifestSignature {
    param(
        [Parameter(Mandatory)] [string] $ContentPath,
        [Parameter(Mandatory)] [string] $SignaturePath
    )
    if (-not (Test-Path -LiteralPath $SignaturePath -PathType Leaf)) {
        throw "Detached manifest signature is missing: $SignaturePath"
    }
    $content = [IO.File]::ReadAllBytes($ContentPath)
    $signatureBytes = [IO.File]::ReadAllBytes($SignaturePath)
    $cms = [Security.Cryptography.Pkcs.SignedCms]::new(
        [Security.Cryptography.Pkcs.ContentInfo]::new($content),
        $true
    )
    $cms.Decode($signatureBytes)
    $cms.CheckSignature($true)
    if ($cms.SignerInfos.Count -ne 1 -or $cms.Certificates.Count -lt 1) {
        throw 'Detached manifest signature must contain exactly one signer.'
    }
    return $cms.Certificates[0]
}

$binaryPaths = @(Get-RequiredBinaryPaths)

if (-not $VerifyOnly) {
    if ([string]::IsNullOrWhiteSpace($PfxPath) -or -not (Test-Path -LiteralPath $PfxPath -PathType Leaf)) {
        throw 'A code-signing PFX is required. Set ANIME4K_SIGNING_PFX_PATH or pass -PfxPath.'
    }
    if ([string]::IsNullOrWhiteSpace($PfxPassword)) {
        throw 'The PFX password is required in ANIME4K_SIGNING_PFX_PASSWORD or -PfxPassword.'
    }
    $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new(
        [IO.Path]::GetFullPath($PfxPath),
        $PfxPassword,
        [Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
    )
    if (-not $certificate.HasPrivateKey) {
        throw 'The signing certificate does not contain a private key.'
    }

    foreach ($path in $binaryPaths) {
        $result = Set-AuthenticodeSignature -LiteralPath $path -Certificate $certificate `
            -HashAlgorithm SHA256 -TimestampServer $TimestampUrl
        if ($result.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
            throw "Signing failed for $path ($($result.Status): $($result.StatusMessage))"
        }
    }

    $files = @($binaryPaths | Sort-Object | ForEach-Object {
        $item = Get-Item -LiteralPath $_
        [ordered]@{
            path = $item.Name
            bytes = [long] $item.Length
            sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    })
    $manifest = [ordered]@{
        version = 1
        algorithm = 'SHA-256'
        signerThumbprint = $certificate.Thumbprint.ToUpperInvariant()
        files = $files
    } | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText($manifestPath, "$manifest`n", [Text.UTF8Encoding]::new($false))

    $contentInfo = [Security.Cryptography.Pkcs.ContentInfo]::new([IO.File]::ReadAllBytes($manifestPath))
    $cms = [Security.Cryptography.Pkcs.SignedCms]::new($contentInfo, $true)
    $signer = [Security.Cryptography.Pkcs.CmsSigner]::new(
        [Security.Cryptography.Pkcs.SubjectIdentifierType]::IssuerAndSerialNumber,
        $certificate
    )
    $signer.IncludeOption = [Security.Cryptography.X509Certificates.X509IncludeOption]::EndCertOnly
    $cms.ComputeSignature($signer)
    [IO.File]::WriteAllBytes($manifestSignaturePath, $cms.Encode())
}

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Signed release manifest is missing: $manifestPath"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([int] $manifest.version -ne 1 -or [string] $manifest.algorithm -ne 'SHA-256') {
    throw 'Unsupported native release manifest.'
}
$manifestSigner = Test-DetachedManifestSignature -ContentPath $manifestPath -SignaturePath $manifestSignaturePath
if ($manifestSigner.Thumbprint.ToUpperInvariant() -ne ([string] $manifest.signerThumbprint).ToUpperInvariant()) {
    throw 'The detached manifest signer does not match the recorded signer thumbprint.'
}

$manifestFiles = @($manifest.files)
if ($manifestFiles.Count -ne $requiredNames.Count) {
    throw 'The native release manifest contains an unexpected file set.'
}
foreach ($path in $binaryPaths) {
    $name = [IO.Path]::GetFileName($path)
    $entry = @($manifestFiles | Where-Object { [string] $_.path -ceq $name })
    if ($entry.Count -ne 1) { throw "Manifest entry is missing or duplicated: $name" }
    $item = Get-Item -LiteralPath $path
    if ([long] $entry[0].bytes -ne [long] $item.Length) { throw "Manifest size mismatch: $name" }
    $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ([string] $entry[0].sha256 -cne $actualHash) { throw "Manifest hash mismatch: $name" }
    $authenticodeSigner = Assert-CodeSignature -Path $path
    if ($authenticodeSigner.Thumbprint.ToUpperInvariant() -ne $manifestSigner.Thumbprint.ToUpperInvariant()) {
        throw "Authenticode and manifest signers differ: $name"
    }
}

Write-Host "Verified signed native release in $binaryRoot"
