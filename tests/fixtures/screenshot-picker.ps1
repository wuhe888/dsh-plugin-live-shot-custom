# Compile the shipped picker in the same background PowerShell host as Desktop.
param([Parameter(Mandatory=$true)][string]$PluginDirectory, [switch]$MultipleDisplays)
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
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window,uint message,IntPtr wParam,IntPtr lParam);
}
'@
[PickerApi]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
[System.Windows.Forms.Application]::EnableVisualStyles()
if ($MultipleDisplays) {
  $displays = [System.Drawing.Rectangle[]]@(
    [System.Drawing.Rectangle]::new(-2560,-2600,2560,1440),
    [System.Drawing.Rectangle]::new(0,-2400,1920,1080),
    [System.Drawing.Rectangle]::new(1920,-2700,2560,1440))
  $group = New-Object MonitorSelection
  $outcomes = [System.Collections.Generic.List[object]]::new()
  $done = [Action[System.Collections.Generic.Dictionary[string,object]]]{param($outcome) $outcomes.Add($outcome)}
  foreach ($target in 0,1,2,1) {
    $group.Show($displays,$done)
    try {
      $windows = @([System.Windows.Forms.Application]::OpenForms | Sort-Object Left)
      if ($windows.Count -ne 3) { throw 'Expected one picker per display' }
      $handles = @($windows | ForEach-Object { $_.Handle })
      for ($i=0; $i -lt 3; $i++) {
        $rect = New-Object PickerWindowProbe+Rect
        if (-not [PickerWindowProbe]::GetWindowRect($handles[$i],[ref]$rect)) { throw 'Cannot read picker bounds' }
        $actual = [System.Drawing.Rectangle]::FromLTRB($rect.Left,$rect.Top,$rect.Right,$rect.Bottom)
        if ($actual -ne $displays[$i]) { throw "Picker bounds $actual did not cover display $($displays[$i])" }
        if ($i -gt 0 -and ($windows[$i].EscapeHook -or $windows[$i].EscapeRawInput)) { throw 'Duplicate keyboard registration' }
      }
      if ($outcomes.Count -eq 3) { $group.Primary.CancelSelection() }
      else {
        [PickerWindowProbe]::SendMessage($handles[$target],0x201,[IntPtr]1,[IntPtr]((9 -shl 16) + 8)) | Out-Null
        [PickerWindowProbe]::SendMessage($handles[$target],0x202,[IntPtr]0,[IntPtr]((59 -shl 16) + 88)) | Out-Null
      }
      if ($null -ne $group.Primary -or @($handles | Where-Object { [PickerWindowProbe]::IsWindow($_) }).Count) { throw 'Picker still open' }
    } finally { if ($group.Primary) { $group.Primary.CancelSelection() } }
  }
  $outcomes | ForEach-Object { $_ | ConvertTo-Json -Compress }
  return
}
for ($attempt=1;$attempt -le 2;$attempt++) {
  # Off-screen windows exercise native creation without covering the user's desktop.
  $bounds = [System.Drawing.Rectangle]::new(-32000,-32000,64,64)
  $window = New-Object NativeSelectionWindow $bounds, ([Action[System.Collections.Generic.Dictionary[string,object]]]{param($result)}), $true
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
