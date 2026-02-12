Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class KBSend {
 [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
 const uint KEYEVENTF_KEYUP = 0x0002;
 public static void Tap(byte vk){
  keybd_event(vk,0,0,UIntPtr.Zero);
  keybd_event(vk,0,KEYEVENTF_KEYUP,UIntPtr.Zero);
 }
}
"@ -ErrorAction SilentlyContinue

# Persistent daemon — reads VK codes from stdin, sends immediately
while ($true) {
  $line = [Console]::ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq 'EXIT') { break }
  if ($line -match '^\d+$') {
    [KBSend]::Tap([byte][int]$line)
    [Console]::WriteLine('OK')
  }
}
