param(
    [string]$SmtpLogin = 'bbcbbd001@smtp-brevo.com',
    [string]$TestRecipient = 'maicollt13@gmail.com'
)

Write-Host "Usuario SMTP: $SmtpLogin"
Write-Host "Se enviara UNA prueba a: $TestRecipient"
$smtpSecret = Read-Host 'Pega la clave SMTP (no se mostrara)' -AsSecureString
$secretPointer = [IntPtr]::Zero
try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpSecret)
    $testPayload = @{
        user = $smtpLogin.Trim()
        to = $testRecipient.Trim()
        password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    }
    $testPayload | ConvertTo-Json -Compress | node "$PSScriptRoot/test-brevo.mjs" --send
} finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    if ($testPayload) { $testPayload.Clear() }
    $smtpSecret.Dispose()
}
