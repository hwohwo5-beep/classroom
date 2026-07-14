$files = Get-ChildItem -Path "c:\Users\wkatl\Desktop\classroom" -Recurse -Include "*.tsx","*.ts" | Where-Object { $_.FullName -notmatch "node_modules|\.next" }
foreach ($f in $files) {
  $matches = Select-String -Path $f.FullName -Pattern "클래스룸"
  foreach ($m in $matches) {
    Write-Output ($f.Name + ":" + $m.LineNumber + ":" + $m.Line.Trim())
  }
}