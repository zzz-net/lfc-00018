
$baseUrl = "http://localhost:3001/api"
$cookieContainer = New-Object System.Net.CookieContainer
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = $cookieContainer
$client = New-Object System.Net.Http.HttpClient($handler)

function Write-Section($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

function Invoke-Api($method, $path, $body = $null, $isForm = $false) {
    $uri = "$baseUrl$path"
    if ($body -and -not $isForm) {
        $json = $body | ConvertTo-Json -Depth 10
        $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json")
        $resp = $client.SendAsync((New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::$method, $uri) -Property @{ Content = $content })).Result
    } elseif ($isForm) {
        $resp = $client.PostAsync($uri, $body).Result
    } else {
        $resp = $client.GetAsync($uri).Result
    }
    $resp.EnsureSuccessStatusCode()
    $result = $resp.Content.ReadAsStringAsync().Result
    return $result | ConvertFrom-Json
}

Write-Section "1. 登录"
$loginBody = @{ username = "admin"; password = "admin123" }
$result = Invoke-Api "Post" "/auth/login" $loginBody
Write-Host "登录成功: $($result.data.name) ($($result.data.role))"
$cookies = $cookieContainer.GetCookies($baseUrl)
Write-Host "Cookie 数量: $($cookies.Count)"

Write-Section "2. 预检查 - 正确格式 CSV (test_import_good.csv)"
$filePath = "d:\workSpace\AI__SPACE\lfc-00018\test_import_good.csv"
$multipart = New-Object System.Net.Http.MultipartFormDataContent
$fileStream = [System.IO.File]::OpenRead($filePath)
$streamContent = New-Object System.Net.Http.StreamContent($fileStream)
$streamContent.Headers.ContentType = "text/csv"
$multipart.Add($streamContent, "file", "test_import_good.csv")
$result = Invoke-Api "Post" "/users/import/precheck" $multipart $true
$fileStream.Close()

Write-Host "总行数: $($result.data.totalRows)"
Write-Host "有效行: $($result.data.validRows)"
Write-Host "无效行: $($result.data.invalidRows)"
Write-Host "表头问题: $($result.data.headerIssues.Count)"
if ($result.data.rowErrors.Count -gt 0) {
    Write-Host "行错误:"
    foreach ($err in $result.data.rowErrors) {
        Write-Host "  第$($err.lineNumber)行: $($err.errors.Count) 个错误"
        foreach ($e in $err.errors) {
            Write-Host "    - $($e.type): $($e.message)"
        }
    }
}

Write-Section "3. 预检查 - 多错误 CSV (test_import_errors.csv)"
$filePath = "d:\workSpace\AI__SPACE\lfc-00018\test_import_errors.csv"
$multipart = New-Object System.Net.Http.MultipartFormDataContent
$fileStream = [System.IO.File]::OpenRead($filePath)
$streamContent = New-Object System.Net.Http.StreamContent($fileStream)
$streamContent.Headers.ContentType = "text/csv"
$multipart.Add($streamContent, "file", "test_import_errors.csv")
$result = Invoke-Api "Post" "/users/import/precheck" $multipart $true
$fileStream.Close()

Write-Host "总行数: $($result.data.totalRows)"
Write-Host "有效行: $($result.data.validRows)"
Write-Host "无效行: $($result.data.invalidRows)"
Write-Host "表头问题: $($result.data.headerIssues.Count)"
foreach ($issue in $result.data.headerIssues) {
    Write-Host "  - $($issue.type): $($issue.message) (列: $($issue.column))"
}
Write-Host "行错误数: $($result.data.rowErrors.Count)"
foreach ($err in $result.data.rowErrors) {
    Write-Host "  第$($err.lineNumber)行 ($($err.rowData.姓名)): $($err.errors.Count) 个错误"
    foreach ($e in $err.errors) {
        Write-Host "    - $($e.type): $($e.message)"
    }
}

Write-Section "4. 保存导入草稿"
$rawCsv = [System.IO.File]::ReadAllText("d:\workSpace\AI__SPACE\lfc-00018\test_import_good.csv")
$draftPayload = @{
    fileName = "test_import_good.csv"
    fileSize = $rawCsv.Length
    rawCsvContent = $rawCsv
    fieldMapping = @{
        username = "username"
        name = "name"
        role = "role"
        email = "email"
        password = "password"
    }
    precheckResult = $result.data
}
$result = Invoke-Api "Post" "/users/import/draft" $draftPayload
Write-Host "草稿保存成功，ID: $($result.data.id)"
Write-Host "文件名: $($result.data.fileName)"
Write-Host "更新时间: $($result.data.updatedAt)"

Write-Section "5. 读取导入草稿"
$result = Invoke-Api "Get" "/users/import/draft"
if ($result.success -and $result.data) {
    Write-Host "草稿存在: $($result.data.fileName) ($($result.data.fileSize) bytes)"
    Write-Host "映射字段: $($result.data.fieldMapping | ConvertTo-Json -Compress)"
} else {
    Write-Host "没有草稿"
}

Write-Section "6. 错误行导出"
$exportPayload = @{
    rawCsv = $rawCsv
    fieldMapping = @{
        username = "username"
        name = "name"
        role = "role"
        email = "email"
        password = "password"
    }
}
# 这个需要用特殊方式处理，因为返回的是文件
$uri = "$baseUrl/users/import/export-errors"
$json = $exportPayload | ConvertTo-Json -Depth 5
$content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json")
$resp = $client.PostAsync($uri, $content).Result
$resp.EnsureSuccessStatusCode()
$exportData = $resp.Content.ReadAsByteArrayAsync().Result
$exportPath = "d:\workSpace\AI__SPACE\lfc-00018\test_export_errors.csv"
[System.IO.File]::WriteAllBytes($exportPath, $exportData)
Write-Host "错误导出文件: $exportPath"
Write-Host "文件大小: $($exportData.Length) bytes"
Write-Host "文件内容预览:"
Get-Content $exportPath -Head 10 | ForEach-Object { Write-Host "  $_" }

Write-Section "所有 API 测试完成！"
