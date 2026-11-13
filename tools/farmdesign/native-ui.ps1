param([Parameter(Mandatory=$true)][string]$Session,[ValidateSet('browser','desktop')][string]$Mode='browser',[switch]$CompileOnly)
$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
try {
 $bin=Join-Path $Session 'Bin'
 Set-Location -LiteralPath $bin
 [Environment]::CurrentDirectory=$bin
 Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Data,System.Xml,System.Web.Extensions
 if($CompileOnly){
  $parameters=New-Object CodeDom.Compiler.CompilerParameters
  $parameters.GenerateExecutable=$true
  $parameters.GenerateInMemory=$false
  $parameters.OutputAssembly=Join-Path $bin 'FarmSystemOriginal.exe'
  $parameters.CompilerOptions='/platform:x86 /target:exe'
  foreach($reference in @('System.dll','System.Core.dll','System.Drawing.dll','System.Windows.Forms.dll','System.Data.dll','System.Xml.dll','System.Web.Extensions.dll','Microsoft.CSharp.dll')){[void]$parameters.ReferencedAssemblies.Add($reference)}
  $provider=New-Object Microsoft.CSharp.CSharpCodeProvider
  $compiled=$provider.CompileAssemblyFromFile($parameters,[string[]]@((Join-Path $PSScriptRoot 'NativeUi.cs'),(Join-Path $PSScriptRoot 'NativeHost.cs')))
  if($compiled.Errors.HasErrors){throw ($compiled.Errors | Out-String)}
  exit 0
 }
 [Windows.Forms.Application]::EnableVisualStyles()
 [Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)
 [Windows.Forms.Application].GetField('startupPath',[Reflection.BindingFlags]'Static,NonPublic').SetValue($null,$bin)
 $dal=[Reflection.Assembly]::LoadFrom((Join-Path $bin 'DAL.dll'))
 $exe=[Reflection.Assembly]::LoadFrom((Join-Path $bin 'FarmDESIGN.exe'))
 $flags=[Reflection.BindingFlags]'Static,Instance,NonPublic,Public'
 $applType=$dal.GetType('DAL.General.Init.ApplInit')
 [xml]$config=Get-Content -LiteralPath (Join-Path $bin 'applConfig.FarmDESIGN.ini') -Raw
 $ctor=$applType.GetConstructor($flags,$null,[type[]]@([Xml.XmlNodeList]),$null)
 $arguments=New-Object object[] 1
 $arguments[0]=$config.DocumentElement.SelectNodes('element')
 $appl=$ctor.Invoke($arguments)
 $applType.GetField('_instance',$flags).SetValue($null,$appl)
 $applType.GetField('parentAppName',$flags).SetValue($null,'FarmDESIGN')
 Add-Type -Path (Join-Path $PSScriptRoot 'NativeUi.cs') -ReferencedAssemblies 'System.Drawing','System.Windows.Forms','System.Data','System.Xml','System.Core','System.Web.Extensions'
 $form=[Activator]::CreateInstance($exe.GetType('Design.GUI.InputForm'))
 if(-not $form.IsOK){throw 'The original FarmDESIGN form did not initialize'}
 $ui=New-Object FarmSystemNative.NativeUi($form,$Session,($Mode -eq 'browser'))
 $ui.Run()
} catch {
 [Console]::WriteLine('@@FARMUI@@'+(@{ready=$false;error=$_.Exception.ToString()} | ConvertTo-Json -Compress))
 exit 1
}
