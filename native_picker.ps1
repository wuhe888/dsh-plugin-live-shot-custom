#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
# The Node controller reads and writes the redirected JSON stream as UTF-8.
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName System.Drawing,System.Windows.Forms,System.Web.Extensions
Add-Type -Path (Join-Path $PSScriptRoot 'native_picker.cs') -ReferencedAssemblies System.Drawing,System.Windows.Forms,System.Web.Extensions
[NativeSelectionServer]::Run($PSScriptRoot)
