param([Parameter(Mandatory=$true)][string]$InputDocx,[Parameter(Mandatory=$true)][string]$OutputPdf)
$ErrorActionPreference = 'Stop'
$resumeWord = $null
$resumeDocument = $null
try {
  $resumeWord = New-Object -ComObject Word.Application
  $resumeWord.Visible = $false
  $resumeWord.DisplayAlerts = 0
  $resumeDocument = $resumeWord.Documents.Open($InputDocx, $false, $true)
  $resumeDocument.ExportAsFixedFormat($OutputPdf, 17)
} finally {
  if ($null -ne $resumeDocument) { $resumeDocument.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($resumeDocument) }
  if ($null -ne $resumeWord) { $resumeWord.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($resumeWord) }
}
