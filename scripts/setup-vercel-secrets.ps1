param(
  [string[]]$Environments = @("production", "preview", "development")
)

$ErrorActionPreference = "Stop"

function ConvertTo-PlainText {
  param([System.Security.SecureString]$SecureValue)

  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function ConvertTo-Base64Url {
  param([byte[]]$Bytes)

  return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-RandomBytes {
  param([int]$Length)

  $bytes = New-Object byte[] $Length
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return $bytes
  }
  finally {
    $rng.Dispose()
  }
}

function New-PasswordHash {
  param([string]$Password)

  $iterations = 310000
  $saltBytes = New-RandomBytes 16

  $derive = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
    $Password,
    $saltBytes,
    $iterations,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )

  try {
    $hashBytes = $derive.GetBytes(32)
    $salt = ConvertTo-Base64Url $saltBytes
    $hash = ConvertTo-Base64Url $hashBytes
    return "pbkdf2`$$iterations`$$salt`$$hash"
  }
  finally {
    $derive.Dispose()
  }
}

function Add-VercelSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  $target = $Environments -join ","
  $Value | & npx vercel env add $Name $target --sensitive --force

  if ($LASTEXITCODE -ne 0) {
    throw "Could not set Vercel environment variable: $Name"
  }
}

if (-not (Test-Path ".vercel/project.json")) {
  throw "This folder is not linked to Vercel yet. Run: npx vercel link --yes --project private-reselling-os"
}

$serviceRoleSecure = Read-Host "Supabase service role key" -AsSecureString
$email = Read-Host "Login email for the private app"
$passwordSecure = Read-Host "Login password, minimum 10 characters" -AsSecureString

if ([string]::IsNullOrWhiteSpace($email) -or $email -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
  throw "Enter a valid email address."
}

$serviceRole = ConvertTo-PlainText $serviceRoleSecure
$password = ConvertTo-PlainText $passwordSecure

if ([string]::IsNullOrWhiteSpace($serviceRole)) {
  throw "Supabase service role key is required."
}

if ($password.Length -lt 10) {
  throw "Choose a password with at least 10 characters."
}

$passwordHash = New-PasswordHash $password

Add-VercelSecret "SUPABASE_SERVICE_ROLE_KEY" $serviceRole
Add-VercelSecret "SINGLE_USER_EMAIL" $email
Add-VercelSecret "SINGLE_USER_PASSWORD_HASH" $passwordHash

Write-Host "Vercel secrets are set. You can deploy with: npx vercel --prod"
