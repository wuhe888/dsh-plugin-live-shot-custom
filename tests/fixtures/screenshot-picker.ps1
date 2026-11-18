# Compile the shipped picker in the same background PowerShell host as Desktop.
param([Parameter(Mandatory=$true)][string]$PluginDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing,System.Windows.Forms,System.Web.Extensions
Add-Type -Path (Join-Path $PluginDirectory 'native_picker.cs') -ReferencedAssemblies System.Drawing,System.Windows.Forms,System.Web.Extensions
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PickerWindowProbe {
  [DllImport("user32.dll")] public static extern IntPtr GetWindowLongPtr(IntPtr window,int index);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window,out Rect rect);
}
'@
[PickerApi]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
[System.Windows.Forms.Application]::EnableVisualStyles()
for ($attempt=1;$attempt -le 2;$attempt++) {
  # Off-screen windows exercise native creation without covering the user's desktop.
  $bounds = [System.Drawing.Rectangle]::new(-32000,-32000,64,64)
  $window = New-Object NativeSelectionWindow $bounds, ([Action[System.Collections.Generic.Dictionary[string,object]]]{param($result)})
  try {
    $window.Show()
    $handle = $window.Handle
    $style = [PickerWindowProbe]::GetWindowLongPtr($handle,-20).ToInt64()
    $rect = New-Object PickerWindowProbe+Rect
    if (-not [PickerWindowProbe]::GetWindowRect($handle,[ref]$rect)) { throw 'Cannot read picker bounds' }
    $result = [ordered]@{
      attempt=$attempt
      visible=[PickerWindowProbe]::IsWindowVisible($handle)
      topmost=(($style -band 8) -ne 0)
      noActivate=(($style -band 0x08000000) -ne 0)
      bounds=@($rect.Left,$rect.Top,($rect.Right-$rect.Left),($rect.Bottom-$rect.Top))
    }
  } finally {
    $window.CancelSelection()
    $window.Dispose()
  }
  $result['closed'] = -not [PickerWindowProbe]::IsWindow($handle)
  $result | ConvertTo-Json -Compress
}
